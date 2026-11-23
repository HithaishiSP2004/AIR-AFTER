"""Data orchestration with bounded TTL and disclosure of missing sources."""
import asyncio
import time
from datetime import datetime, timezone
from app.domain.models import Location, AirSnapshot, Evidence
from app.providers import openaq, openmeteo
from app.config import OPENAQ_API_KEY

_CACHE: dict[str, tuple[float, AirSnapshot]] = {}
_TTL_SECONDS = 8 * 60


def recent(reading: Evidence, now: datetime) -> bool:
    return -1 <= (now - reading.measured_at).total_seconds() / 3600 <= openaq.FRESH_HOURS


def choose_primary(observed: list[Evidence], modeled: Evidence | None, now: datetime) -> Evidence | None:
    fresh = [r for r in observed if r.pollutant == "pm2_5" and not r.stale and recent(r, now)]
    if fresh: return fresh[0]
    if modeled and not modeled.stale and recent(modeled, now):
        return modeled
    return None

async def get_air(location: Location) -> AirSnapshot:
    cache_key = f"{location.latitude:.4f}:{location.longitude:.4f}"
    cached = _CACHE.get(cache_key)
    if cached and time.monotonic() < cached[0]:
        snapshot = cached[1]
        now = datetime.now(timezone.utc)
        return snapshot.model_copy(update={
            "location": location, "forecast": [point for point in snapshot.forecast if point.time >= now]})

    now = datetime.now(timezone.utc)
    observations_task = openaq.get_observations(location, now) if OPENAQ_API_KEY else asyncio.sleep(0, result=[])
    observation_result, model_result = await asyncio.gather(
        observations_task, openmeteo.get_model(location), return_exceptions=True)
    observed = observation_result if isinstance(observation_result, list) else []
    modeled, forecast = model_result if isinstance(model_result, tuple) else (None, [])
    now = datetime.now(timezone.utc)
    observed = [r.model_copy(update={"stale": not recent(r, now)}) for r in observed]
    if modeled and not recent(modeled, now):
        modeled = modeled.model_copy(update={"stale": True})
    forecast = [point for point in forecast if point.time >= now]
    warnings: list[str] = []
    if isinstance(observation_result, Exception) and OPENAQ_API_KEY:
        warnings.append("Station provider is temporarily unavailable.")
    elif OPENAQ_API_KEY and not any(o.pollutant == "pm2_5" for o in observed):
        warnings.append("Nearby stations returned no usable PM2.5 observation.")
    if not OPENAQ_API_KEY:
        warnings.append("Station observations are unavailable for this lookup.")
    if isinstance(model_result, Exception):
        warnings.append("Atmospheric model is temporarily unavailable.")
    pm_observations = [o for o in observed if o.pollutant == "pm2_5"]
    if pm_observations and all(o.stale for o in pm_observations):
        warnings.append("Nearby PM2.5 monitoring data is stale; do not treat it as current.")
    primary = choose_primary(observed, modeled, now)
    if primary is None:
        warnings.append("No sufficiently recent PM2.5 value is available. No AQI is shown.")
    snap = AirSnapshot(location=location, primary=primary, observed=observed[:12], modeled=modeled,
                       forecast=forecast, fetched_at=now, warnings=warnings)
    if len(_CACHE) >= 64:
        oldest = min(_CACHE, key=lambda key: _CACHE[key][0])
        _CACHE.pop(oldest, None)
    # No cached reading may cross its freshness threshold while still labelled current.
    ttl = _TTL_SECONDS if primary else 90
    for reading in [*observed, modeled]:
        if reading and not reading.stale:
            ttl = min(ttl, openaq.FRESH_HOURS * 3600 - (now - reading.measured_at).total_seconds())
    _CACHE[cache_key] = (time.monotonic() + ttl, snap)
    return snap
