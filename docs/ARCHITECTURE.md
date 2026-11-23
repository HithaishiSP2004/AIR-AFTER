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

Code boundary: `app/providers/*` is never a user-interface module. `app/domain/*` has no HTTP dependency. AI cannot set numeric environmental facts in our evidence payload. Gemini receives a bounded catalog of approved decisions plus household and forecast context. It selects a decision, action indices and an optional forecast index. Application code validates the selection, assembles the answer and supplies evidence and source labels. Authentication or quota errors stop attempts. A missing model, invalid selection or transient service failure can use one alternate model.

## Privacy / operations

- Selected location and broad household preferences persist in browser localStorage. Requests include them for guidance, and enabled Gemini requests include household context. No authentication or personal records.
- API keys remain in the server process. Never use `NEXT_PUBLIC_` or put keys in JavaScript.
- CSP prohibits off-origin browser requests and inline scripts. Only the backend contacts providers.
- One-process cache of max 64 entries reduces calls; server restarts invalidate cache. Production at scale should use provider-aware distributed caching and gateway rate limits.
- `/api/ask` has an in-memory per-process rate guard; this is intentionally not presented as a production distributed security boundary.
- External fetches have seven-second timeout, disabled redirects and bounded JSON response sizes. Ask AIR allows up to eight seconds for environmental context and 17 seconds total for the model sequence. The browser uses a 30-second assistant timeout.

## Deliberate omissions

There is no login, paid geospatial service, fabricated data fallback, medical-risk model, city-level route planner, database, push notification, agent orchestrator, uncontrolled AI tool calling, or frontend build system. These omissions reduce failure surface, preserve the size limit, and keep the prototype auditable.

## API contracts

See `app/domain/models.py` for Pydantic schemas. Test each route with `python -m pytest` and inspect available HTTP methods through `app/main.py`. Clients must handle `429`, `422`, and provider `503` errors, plus null environmental readings.
