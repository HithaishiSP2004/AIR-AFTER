# AIR / AFTER

### See what your choices change.

**An India-first, context-aware air-quality decision assistant** for Hack2skill / PromptWars Virtual — Challenge 06: Urban Air Quality Assistant.

AIR / AFTER is not another AQI counter. It combines actual provider data, explicit observation-vs-model provenance, household-specific routine suggestions, transparent decision comparisons, indoor air-quality guidance and an optional Gemini explanation layer. The visual language is deliberately distinctive: **atmospheric editorial**, not a copied AI dashboard.

> **Status:** A functional code foundation with running FastAPI routes, a designed responsive frontend, source-aware air provider adapters, typed schemas, calculators, tests and optional Gemini integration. **Real external API calls and Gemini live calls require verification in your network/deployment environment; they could not be exercised from the offline build environment.** Automated provider-fixture and browser rendering checks are not live-provider verification.

## Start in under two minutes

Requires Python **3.11+**, Git and an internet connection for dependency installation and environmental-data requests.

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
python -m pytest -q
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000**.

No key is required for the modeled Open-Meteo data provider (subject to its access terms and network availability). Add secrets to `.env` only:

```env
OPENAQ_API_KEY=your_open_aq_v3_key
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

Never commit `.env`. OpenAQ adds nearby station observations. Gemini adds AI explanations; without it, the assistant clearly identifies itself as **rule-based guidance**. All features still display appropriate source/data-availability states when providers are offline.

## The product's four experiences

| Experience | What works today | Distinctive evidence principle |
|---|---|---|
| **01 · Air Intelligence** | India location presets/search, current modeled PM2.5, optional station observations, 24-hour model chart, household-aware advice, source details | Never confuses model with station or claims an instant PM measurement is India's official AQI |
| **02 · Decision Studio** | Interactive solo/shared vehicle allocation, errand distance scenario, contextual playtime guidance | Separates emissions from exposure, explains assumptions rather than claiming unverifiable personal health outcomes |
| **03 · Home Air Lab** | Room size, ceiling and clean-air-change controls; CADR target; indoor source-control guidance | No invented indoor AQI; transparent calculation vs measurement distinction |
| **04 · Ask AIR** | Structured Gemini REST interface with validated output + deterministic fallback, contextual household input, starter questions | Evidence comes from providers; AI explains but doesn't manufacture environmental data |

**Core audience:** households, parents, commuters, and communities navigating urban pollution and winter smog in India.

## Why this stack?

- **Python / FastAPI / Pydantic**: clear, typed, testable decision and provider logic; narrow HTTP surface.
- **Native HTML/CSS/JavaScript**: no npm bundle, no generic UI library, no build step, tiny repository and excellent runtime efficiency.
- **Custom Canvas 2D**: bespoke living-atmosphere illustration with capped density, reduced motion and visibility suspension.
- **OpenAQ v3, Open-Meteo/CAMS**: separate station measurements from atmospheric model estimates.
- **Gemini REST (optional)**: structured JSON explanation fed grounded environmental data, with server-side credential handling.

More architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Detailed sources and citations: [`docs/SOURCES.md`](docs/SOURCES.md).

## Project map

```text
app/
  main.py                 # Same-origin frontend + API routes, validation, headers
  air_service.py          # Provider orchestration, preference for fresh observations, TTL cache
  assistant.py            # Gemini REST + explicit rules fallback
  config.py               # Server-side keys only
  providers/              # OpenAQ, Open-Meteo, geocoding, safe HTTP boundary
  domain/                 # Typed contracts, explainable rules, impact calculators
web/
  index.html              # All four real interactive views, modals, accessible labels
  assets/styles.css       # Original atmospheric editorial design system
  assets/app.js           # Native UI state, forecast renderer, Canvas, API interactions
  assets/mark.svg         # Custom icon
tests/                    # Domain, normalization, failure and endpoint tests
docs/                     # Scientific citations, design DNA, QA, and architecture
```

## Trust and assumptions

- Air-quality measurements may be sparse or stale, and a model is not a nearby monitor. We show timestamps and disclosures.
- The app **does not compute India AQI** from hourly or instantaneous PM2.5. PM2.5 concentration in µg/m³ is its own measurement, not an AQI score.
- The emissions comparison uses **US EPA illustrative gasoline tailpipe CO₂/vehicle-km**, not an India-calibrated fleet factor, and only allocates the *same vehicle's* emissions across occupants. It does not claim that sharing a seat reduces that vehicle's emissions; avoided trip cases require a separate counterfactual.
- The CADR estimate is volume × selected equivalent clean-air-change target; it cannot measure indoor pollution.
- Guidance is for education and planning, not medical diagnosis or an exact exposure-risk prediction.
- Data-provider access is subject to attribution, terms, availability and rate limits.

Methodology and source URLs: [`docs/SOURCES.md`](docs/SOURCES.md).

## API

- `GET /api/health`
- `GET /api/cities?q=Pune`
- `GET /api/air?name=Pune&region=Maharashtra&latitude=18.5204&longitude=73.8567`
- `POST /api/guidance` — `{ "location": {...}, "household": {...} }`
- `POST /api/impact` — `{ "distance_km": 12, "trips_per_week": 10, "occupants": 3 }`
- `POST /api/room` — `{ "area_m2": 20, "ceiling_m": 2.8, "clean_air_changes_hour": 4 }`
- `POST /api/ask` — `{ "question": "Should my child play outside?", "location": {...}, "household": {...} }`

Schema definitions: [`app/domain/models.py`](app/domain/models.py).

## Test and deploy

```bash
python -m compileall -q app
python -m pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Deploy to any Python ASGI host; [`render.yaml`](render.yaml) is provided for Render. Set optional environment variables in your host's secret-manager UI, not inside the code. A functioning, public deployed URL must be checked independently before submission.

End-to-end evaluator checklist and three example users: [`docs/QA_AND_DEMO.md`](docs/QA_AND_DEMO.md).

## Challenge submission constraints

Keep **one public repository**, **one branch** (`main`), **tracked repository under 10 MB**, and no keys, build artifacts, `.venv`, or dependency folders. Include a deployed URL, project code, README, LinkedIn process explanation and working demo recording as instructed in the challenge briefing. **The final attempt score counts; don't resubmit casually.**

## Disclosure

The generated screenshots used while developing this foundation were tested with labeled synthetic browser fixtures because outbound provider access was unavailable in the build environment. **Those fixtures are not shipped as live product values.**
