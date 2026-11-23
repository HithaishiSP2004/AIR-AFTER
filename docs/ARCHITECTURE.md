# Architecture and trust boundaries

```
Browser (HTML/CSS/ES Modules; Canvas 2D)
    │ same-origin fetch; household preferences only in localStorage
    ▼
FastAPI routes — typed Pydantic contracts
    ├── /api/cities   → Open-Meteo geocoding [India only]
    ├── /api/air      → Air service (8-minute bounded in-process cache)
    │                     ├── OpenAQ v3 [X-API-Key; optional sensor observations]
    │                     └── Open-Meteo CAMS [modeled current and hourly forecast]
    ├── /api/guidance → deterministic personalized daily rules + cached evidence
    ├── /api/impact   → deterministic, source-referenced CO₂ allocations
    ├── /api/room     → transparent CADR sizing approximation
    └── /api/ask      → cached evidence + safe prompt → Gemini REST if configured
                                  └── explicit deterministic fallback if not
```

## Actual data semantics

- `observation` = measurement reported by a station through OpenAQ v3, with source time, location, station and freshness flag.
- `model` = CAMS atmospheric model concentration returned by Open-Meteo; not a measured sensor.
- `forecast` = future-hour modeled concentration; not observed.
- `primary` = fresh station PM2.5 if found, else recent modeled PM2.5, else null. No Indian AQI estimate is shown.
- `warnings` = missing keys, stale stations, unavailable provider, or missing recent PM2.5 evidence.

Code boundary: `app/providers/*` is never a user-interface module. `app/domain/*` has no HTTP dependency. AI cannot set numeric environmental facts in our evidence payload. The assistant is asked to interpret an already validated evidence object; final `evidence` and `source` labels come from application code, not the model.

## Privacy / operations

- Browser localStorage only for selected location and broad household preferences. No authentication or personal records.
- API keys remain in the server process. Never use `NEXT_PUBLIC_` or put keys in JavaScript.
- CSP prohibits off-origin browser requests and inline scripts. Only the backend contacts providers.
- One-process cache of max 64 entries reduces calls; server restarts invalidate cache. Production at scale should use provider-aware distributed caching and gateway rate limits.
- `/api/ask` has an in-memory per-process rate guard; this is intentionally not presented as a production distributed security boundary.
- External fetches have seven-second timeout, disabled redirects and bounded JSON response sizes. Gemini POST has 14-second timeout.

## Deliberate omissions

There is no login, paid geospatial service, fabricated data fallback, medical-risk model, city-level route planner, database, push notification, agent orchestrator, uncontrolled AI tool calling, or frontend build system. These omissions reduce failure surface, preserve the size limit, and keep the prototype auditable.

## API contracts

See `app/domain/models.py` for Pydantic schemas. Test each route with `python -m pytest` and inspect available HTTP methods through `app/main.py`. Clients must handle `429`, `422`, and provider `503` errors, plus null environmental readings.
