"""India-only location search via Open-Meteo Geocoding API."""
from urllib.parse import urlencode
from app.domain.models import CityResult
from app.providers.http import ProviderError, fetch_json

async def search_cities(query: str) -> list[CityResult]:
    args = urlencode({"name": query, "count": 8, "language": "en", "format": "json", "countryCode": "IN"})
    data = await fetch_json(f"https://geocoding-api.open-meteo.com/v1/search?{args}")
    if not isinstance(data, dict): raise ProviderError("Malformed geocoder response")
    results = data.get("results", [])
    if not isinstance(results, list):
        raise ProviderError("Malformed geocoder results")
    matches = []
    for result in results:
        if not isinstance(result, dict) or result.get("country_code") != "IN": continue
        try:
            matches.append(CityResult(name=result["name"], region=result.get("admin1") or "India",
                latitude=result["latitude"], longitude=result["longitude"]))
        except (KeyError, ValueError, TypeError):
            continue
    return matches
