"""Size- and time-bounded JSON requests to environmental providers."""
import asyncio
import json

import httpx


class ProviderError(Exception):
    """A remote provider failed, without leaking its response body."""


MAX_BYTES = 800_000


async def fetch_json(url: str, *, headers: dict[str, str] | None = None) -> object:
    try:
        async with asyncio.timeout(7), httpx.AsyncClient(timeout=7, follow_redirects=False) as client:
            async with client.stream("GET", url, headers=headers) as response:
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes(chunk_size=16_384):
                    if len(body) + len(chunk) > MAX_BYTES:
                        raise ProviderError("Provider payload exceeded safety limit")
                    body.extend(chunk)
                return json.loads(body)
    except (httpx.HTTPError, ValueError, TimeoutError, RecursionError) as error:
        raise ProviderError("Environmental provider unavailable") from error
