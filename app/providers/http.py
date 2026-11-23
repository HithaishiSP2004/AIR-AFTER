"""Single boundary for remote calls: strict timeouts, status and JSON limits."""
import httpx

class ProviderError(Exception):
    """A remote provider failed, without leaking its response body."""

async def fetch_json(url: str, *, headers: dict[str, str] | None = None) -> object:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(7.0), follow_redirects=False) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            if len(response.content) > 800_000:
                raise ProviderError("Provider payload exceeded safety limit")
            return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise ProviderError("Environmental provider unavailable") from error
