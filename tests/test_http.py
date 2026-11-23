"""HTTP boundary tests use an in-process provider fixture."""
import asyncio

import httpx
import pytest

from app.providers import http


@pytest.mark.parametrize("payload, valid", [(b'{"ok":true}', True), (b"x" * 800_001, False), (b"{", False)])
def test_provider_response_boundary(monkeypatch, payload, valid):
    transport = httpx.MockTransport(lambda _: httpx.Response(200, content=payload))
    client = httpx.AsyncClient(transport=transport)
    monkeypatch.setattr(http.httpx, "AsyncClient", lambda **_: client)
    if valid:
        assert asyncio.run(http.fetch_json("https://fixture.invalid")) == {"ok": True}
    else:
        with pytest.raises(http.ProviderError):
            asyncio.run(http.fetch_json("https://fixture.invalid"))
