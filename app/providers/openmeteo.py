"""Open-Meteo CAMS data: modeled concentrations, NEVER station observations."""
from datetime import datetime, timezone
from urllib.parse import urlencode
from app.domain.models import Location, Evidence, ForecastPoint
from app.providers.http import ProviderError, fetch_json

ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality"
ATTRIBUTION = "Open-Meteo / Copernicus Atmosphere Monitoring Service (CAMS)"


def as_utc(text: str) -> datetime:
    # API requested with timezone=GMT. ISO timestamps without Z are UTC.
    return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)


def number(value: object) -> float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool): return None
    x = float(value)
    if not 0 <= x <= 3000: return None
    return x


def parse_openmeteo(data: object) -> tuple[Evidence | None, list[ForecastPoint]]:
    if not isinstance(data, dict): raise ProviderError("Malformed atmospheric model response")
    current = data.get("current")
    modeled = None
    if isinstance(current, dict):
        pm = number(current.get("pm2_5"))
        stamp = current.get("time")
        if pm is not None and isinstance(stamp, str):
            try:
                dt = as_utc(stamp)
                modeled = Evidence(kind="model", provider=ATTRIBUTION, pollutant="pm2_5",
                    value=pm, measured_at=dt, source_url="https://open-meteo.com/en/docs/air-quality-api")
            except ValueError:
                pass
    hourly = data.get("hourly")
    forecast: list[ForecastPoint] = []
    if isinstance(hourly, dict):
        times, fine, coarse = hourly.get("time"), hourly.get("pm2_5"), hourly.get("pm10")
        if isinstance(times, list) and isinstance(fine, list) and isinstance(coarse, list):
            for time, p25, p10 in zip(times[:72], fine[:72], coarse[:72]):
                if not isinstance(time, str): continue
                try:
                    dt = as_utc(time)
                    forecast.append(ForecastPoint(time=dt, pm2_5=number(p25), pm10=number(p10)))
                except ValueError:
                    continue
    return modeled, forecast

async def get_model(location: Location) -> tuple[Evidence | None, list[ForecastPoint]]:
    query = urlencode({
        "latitude": round(location.latitude, 4), "longitude": round(location.longitude, 4),
        "current": "pm2_5,pm10", "hourly": "pm2_5,pm10",
        "timezone": "GMT", "forecast_days": 3,
    })
    return parse_openmeteo(await fetch_json(f"{ENDPOINT}?{query}"))
