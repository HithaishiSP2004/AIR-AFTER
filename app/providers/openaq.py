"""OpenAQ v3 observations with sensor-based parameter/unit mapping."""
from datetime import datetime, timezone
import asyncio
from urllib.parse import urlencode
from app.domain.models import Location, Evidence
from app.providers.http import ProviderError, fetch_json
from app.config import OPENAQ_API_KEY

BASE = "https://api.openaq.org/v3"
FRESH_HOURS = 6


def parse_stations(data: object) -> list[dict]:
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ProviderError("Malformed station search response")
    good = []
    for item in data["results"]:
        if not isinstance(item, dict) or not isinstance(item.get("id"), int): continue
        country = item.get("country") or {}
        if not isinstance(country, dict) or country.get("code") != "IN": continue
        sensors = item.get("sensors") or []
        if not isinstance(sensors, list): continue
        sensor_map = {}
        for sensor in sensors:
            if not isinstance(sensor, dict): continue
            param = sensor.get("parameter") or {}
            if not isinstance(param, dict): continue
            name = str(param.get("name", "")).lower().replace(".", "")
            units = str(param.get("units", "")).lower().replace(" ", "")
            if name in ("pm25", "pm10") and units in ("µg/m³", "ug/m3", "μg/m³") and isinstance(sensor.get("id"), int):
                sensor_map[sensor["id"]] = "pm2_5" if name == "pm25" else "pm10"
        if sensor_map:
            good.append({"id": item["id"], "name": str(item.get("name") or "Monitoring station")[:100],
                "distance": item.get("distance"), "sensors": sensor_map})
    return sorted(good, key=lambda s: s["distance"] if isinstance(s["distance"], (int,float)) else 999999)


def parse_latest(data: object, station: dict, now: datetime) -> list[Evidence]:
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ProviderError("Malformed station observations")
    readings: list[Evidence] = []
    for entry in data["results"]:
        if not isinstance(entry, dict): continue
        sensor_id = entry.get("sensorsId")
        if type(sensor_id) is not int: continue
        pollutant = station["sensors"].get(sensor_id)
        value, timestamp = entry.get("value"), entry.get("datetime")
        if pollutant is None or not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 3000:
            continue
        if not isinstance(timestamp, dict) or not isinstance(timestamp.get("utc"), str): continue
        try:
            dt = datetime.fromisoformat(timestamp["utc"].replace("Z", "+00:00"))
            if dt.tzinfo is None: continue
            dt = dt.astimezone(timezone.utc)
        except ValueError: continue
        hours = (now - dt).total_seconds() / 3600
        if hours < -1: continue
        distance_m = station.get("distance")
        readings.append(Evidence(kind="observation", provider="OpenAQ", pollutant=pollutant,
            value=float(value), measured_at=dt, station=station["name"],
            distance_km=round(float(distance_m)/1000, 1) if isinstance(distance_m, (int,float)) and distance_m >= 0 else None,
            stale=hours > FRESH_HOURS,
            source_url=f"https://explore.openaq.org/locations/{station['id']}"))
    return readings

async def get_observations(location: Location, now: datetime) -> list[Evidence]:
    if not OPENAQ_API_KEY: return []
    query = urlencode({"coordinates": f"{location.latitude:.4f},{location.longitude:.4f}",
        "radius": 25000, "limit": 15, "iso": "IN"})
    headers = {"X-API-Key": OPENAQ_API_KEY}
    stations = parse_stations(await fetch_json(f"{BASE}/locations?{query}", headers=headers))
    readings: list[Evidence] = []
    # Three nearest station requests in parallel; limits worst-case total latency.
    nearest = stations[:3]
    responses = await asyncio.gather(*[
        fetch_json(f"{BASE}/locations/{station['id']}/latest", headers=headers)
        for station in nearest], return_exceptions=True)
    available = 0
    for station, response in zip(nearest, responses):
        if isinstance(response, Exception):
            continue
        try:
            readings += parse_latest(response, station, now)
            available += 1
        except ProviderError:
            continue
    if nearest and not available:
        raise ProviderError("Station observations unavailable")
    return sorted(readings, key=lambda e: (e.stale, e.distance_km if e.distance_km is not None else 999, -e.measured_at.timestamp()))
