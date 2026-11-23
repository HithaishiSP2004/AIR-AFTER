"""Data orchestration with bounded TTL and disclosure of missing sources."""
import asyncio
import time
from datetime import datetime, timezone
from app.domain.models import Location, AirSnapshot, Evidence
from app.providers import openaq, openmeteo
from app.providers.http import ProviderError
from app.config import OPENAQ_API_KEY

_CACHE: dict[str, tuple[float, AirSnapshot]] = {}
_TTL_SECONDS = 8 * 60


def choose_primary(observed: list[Evidence], modeled: Evidence | None, now: datetime) -> Evidence | None:
    fresh = [r for r in observed if r.pollutant == "pm2_5" and not r.stale]
    if fresh: return fresh[0]
    if modeled and -1 <= (now - modeled.measured_at).total_seconds()/3600 <= 6:
        return modeled
    return None

async def get_air(location: Location) -> AirSnapshot:
    cache_key = f"{location.latitude:.4f}:{location.longitude:.4f}"
    cached = _CACHE.get(cache_key)
    if cached and time.monotonic() < cached[0]:
        return cached[1].model_copy(update={"location": location})

    now = datetime.now(timezone.utc)
    observations_task = openaq.get_observations(location, now) if OPENAQ_API_KEY else asyncio.sleep(0, result=[])
    observation_result, model_result = await asyncio.gather(
        observations_task, openmeteo.get_model(location), return_exceptions=True)
    observed = observation_result if isinstance(observation_result, list) else []
    modeled, forecast = model_result if isinstance(model_result, tuple) else (None, [])
    warnings: list[str] = []
    if isinstance(observation_result, Exception) and OPENAQ_API_KEY:
        warnings.append("Station provider is temporarily unavailable.")
    if not OPENAQ_API_KEY:
        warnings.append("Station observations are not connected; add OPENAQ_API_KEY to enable them.")
    if isinstance(model_result, Exception):
        warnings.append("Atmospheric model is temporarily unavailable.")
    if observed and not any(not o.stale and o.pollutant == "pm2_5" for o in observed):
        warnings.append("Nearby PM2.5 monitoring data is stale; do not treat it as current.")
    primary = choose_primary(observed, modeled, now)
    if primary is None:
        warnings.append("No sufficiently recent PM2.5 value is available. No AQI is shown.")
    snap = AirSnapshot(location=location, primary=primary, observed=observed[:12], modeled=modeled,
                       forecast=forecast, fetched_at=now, warnings=warnings)
    if len(_CACHE) >= 64:
        oldest = min(_CACHE, key=lambda key: _CACHE[key][0])
        _CACHE.pop(oldest, None)
    _CACHE[cache_key] = (time.monotonic() + (_TTL_SECONDS if primary else 90), snap)
    return snap
