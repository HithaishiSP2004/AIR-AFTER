"""Provider fixtures for routing, validation and server-owned assistant text."""
import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app import assistant, config
from app.domain.models import AirSnapshot, ForecastPoint, Household, Location

NOW = datetime(2026, 11, 23, 12, tzinfo=timezone.utc)
CITY = Location(name="New Delhi", latitude=28.6, longitude=77.2)
SNAPSHOT = AirSnapshot(location=CITY, primary=None, fetched_at=NOW,
                       forecast=[ForecastPoint(time=NOW + timedelta(hours=1), pm2_5=29)])
VALID = {"decision": "play", "actions": [1, 0], "forecast_index": 0}


@pytest.fixture(autouse=True)
def clear_test_cooldown(monkeypatch):
    monkeypatch.setattr(assistant, "_quota_retry_at", 0)


def provider_body(selection):
    return {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(selection)}]}}]}


def exercise(monkeypatch, responses):
    requests = []
    client = httpx.AsyncClient

    def fixture(request):
        requests.append(request)
        status, body = responses[len(requests) - 1]
        return httpx.Response(status, json=body, headers={"Retry-After": "60"})

    monkeypatch.setattr(assistant.httpx, "AsyncClient",
                        lambda **kw: client(transport=httpx.MockTransport(fixture), **kw))
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-fixture")
    answer = asyncio.run(assistant.reply("Evening cricket?", SNAPSHOT, Household(), "play"))
    return answer, requests


@pytest.mark.parametrize("status", [400, 401, 403, 429])
def test_terminal_status_uses_rules_without_another_request(monkeypatch, status):
    answer, requests = exercise(monkeypatch, [(status, {})])
    assert answer.mode == "rules"
    assert len(requests) == 1
    if status == 429:
        assert "request limit" in answer.source
        second = asyncio.run(assistant.reply("Plan a journey?", SNAPSHOT, Household()))
        assert second.mode == "rules" and "request limit" in second.source
        assert len(requests) == 1


@pytest.mark.parametrize("failure", [
    (404, {}), (503, {}), (200, provider_body({"title": "invented reading"})),
    (200, provider_body({**VALID, "forecast_index": 1})),
    (200, provider_body({**VALID, "actions": [-1, 1]})),
    (200, provider_body({**VALID, "actions": [1, 1]})),
    (200, provider_body({**VALID, "actions": [True, 0]})),
])
def test_bounded_fallback_selects_validated_guidance(monkeypatch, failure):
    answer, requests = exercise(monkeypatch, [failure, (200, provider_body(VALID))])
    assert len(requests) == 2
    assert requests[0].url != requests[1].url
    assert answer.mode == "gemini"
    assert "29 µg/m³" in answer.evidence and "Forecast" in answer.evidence
    assert "No sufficiently recent" in answer.evidence
    assert "indoor movement" in answer.actions[0]
    context = json.loads(json.loads(requests[0].content)["contents"][0]["parts"][0]["text"])
    assert context["scenario"] == "play"
    assert context["household"]["children"] is True
    assert context["primary"] is None
    assert len(context["forecast_pm25_ug_m3_openmeteo_cams"]) == 1
    assert "test-fixture" not in str(requests[0].url)


def test_total_generation_budget(monkeypatch):
    async def slow(*args):
        await asyncio.sleep(5)
    monkeypatch.setattr(assistant, "BUDGET_SECONDS", .01)
    monkeypatch.setattr(assistant, "_generate", slow)
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-fixture")
    answer = asyncio.run(asyncio.wait_for(assistant.reply("Plan tomorrow?", SNAPSHOT, Household()), 1))
    assert answer.mode == "rules"
    assert "timed out" in answer.source


def test_missing_data_household_actions_and_budget_topic(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    family = Household()
    older = Household(children=False, older_adults=True)
    for profile, word in ((family, "play"), (older, "older")):
        result = asyncio.run(assistant.reply("Plan the day?", SNAPSHOT, profile))
        assert word in result.actions[0]
    result = asyncio.run(assistant.reply("How can I save money at home?", SNAPSHOT, family))
    assert "cost little" in result.title
