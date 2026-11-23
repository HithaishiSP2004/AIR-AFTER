"""Small same-origin FastAPI application. Data routes serve no fabricated values."""
from collections import OrderedDict
from pathlib import Path
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.domain.models import (
    Location, Household, AskInput, JourneyInput, RoomInput,
    AirSnapshot, JourneyComparison, RoomResult, CitySearchResult, AssistantReply, ContextInput,
)
from app.domain.impact import compare_journey, size_air_cleaner
from app.domain.guidance import daily_guidance
from app.air_service import get_air
from app.providers.geocoding import search_cities
from app.providers.http import ProviderError
from app.assistant import reply
import time

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="AIR / AFTER", version="0.1.0", docs_url=None, redoc_url=None)
app.mount("/assets", StaticFiles(directory=ROOT / "web" / "assets"), name="assets")

# Per-process throttling: light abuse mitigation; deployment-wide rate limiting
# must be added upstream for high-volume production traffic.
_ASK_TIMES: OrderedDict[str, list[float]] = OrderedDict()

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
    return response

@app.get("/", include_in_schema=False)
async def home():
    return FileResponse(ROOT / "web" / "index.html", headers={"Cache-Control": "no-cache"})

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "air-after"}

@app.get("/api/cities", response_model=CitySearchResult)
async def cities(q: str = Query(min_length=2, max_length=60)):
    try:
        return CitySearchResult(results=await search_cities(q))
    except ProviderError:
        raise HTTPException(status_code=503, detail="City search is temporarily unavailable")

@app.get("/api/air", response_model=AirSnapshot)
async def air(name: str = Query(min_length=2, max_length=90),
              region: str = Query(default="", max_length=90),
              latitude: float = Query(ge=6, le=38),
              longitude: float = Query(ge=67, le=98)):
    if len(name.strip()) < 2:
        raise HTTPException(status_code=422, detail="Enter a location name with at least two characters")
    location = Location(name=name, region=region, latitude=latitude, longitude=longitude)
    return await get_air(location)

@app.post("/api/ask", response_model=AssistantReply)
async def ask(input: AskInput, request: Request):
    peer = request.client.host if request.client else "anonymous"
    now = time.monotonic()
    while _ASK_TIMES and now - next(iter(_ASK_TIMES.values()))[-1] >= 60:
        _ASK_TIMES.popitem(last=False)
    if peer not in _ASK_TIMES and len(_ASK_TIMES) >= 1024:
        raise HTTPException(status_code=429, detail="Assistant is busy. Please try again shortly.")
    history = [t for t in _ASK_TIMES.get(peer, []) if now - t < 60]
    if len(history) >= 8:
        raise HTTPException(status_code=429, detail="Please pause before asking another question")
    history.append(now)
    _ASK_TIMES[peer] = history
    _ASK_TIMES.move_to_end(peer)
    try:
        snap = await asyncio.wait_for(get_air(input.location), timeout=8)
    except asyncio.TimeoutError:
        snap = AirSnapshot(location=input.location, primary=None, fetched_at=datetime.now(timezone.utc),
                           warnings=["The environmental lookup timed out."])
    return await reply(input.question, snap, input.household, input.scenario)

@app.post("/api/impact", response_model=JourneyComparison)
async def impact(input: JourneyInput):
    return compare_journey(input)

@app.post("/api/room", response_model=RoomResult)
async def room(input: RoomInput):
    return size_air_cleaner(input)

@app.post("/api/guidance")
async def guidance(input: ContextInput):
    snapshot = await get_air(input.location)
    return daily_guidance(snapshot, input.household)
