# AIR / AFTER
## The Living Air Atlas

**See what your choices change.** An India-first air-quality decision assistant for households choosing how to travel, when to play outside and how to manage indoor particle sources. Built for PromptWars Virtual, Challenge 06.

## Run locally

Use Python 3.11 or newer. In PowerShell, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

On macOS or Linux the virtual environment interpreter is `.venv/bin/python`. Open **http://127.0.0.1:8000**. The frontend is served by FastAPI and needs no build.

For station data or AI selection, put `OPENAQ_API_KEY` and/or `GEMINI_API_KEY` in server environment variables or a local `.env`. See [.env.example](.env.example) for optional model configuration. The modeled air and city search providers work without an API key when reachable. The app presents missing data explicitly and still provides household guidance and calculators when providers are offline.

## Four ways to use the atlas

| Experience | Decision | Evidence and assumptions |
| --- | --- | --- |
| Air Intelligence | Choose a city, adjust the household profile and explore the next 24 hours. | A recent OpenAQ PM2.5 observation takes priority over an Open-Meteo/CAMS model estimate. Labels include type, unit and local time. Forecast gaps remain visible. |
| Decision Studio | Compare solo/shared trips, combine errands or plan playtime. | Occupancy divides the vehicle total among passengers. Group savings require confirmation that separate trips of the same length would be replaced without a detour. Errand distances come from the user. |
| Home Air Lab | Inspect cooking, filtration and ventilation in the Breathing Room and size a particle air cleaner. | Room volume times the selected clean-air changes/hour gives a CADR target in cubic metres per hour. Indoor air quality is unmeasured. |
| Ask AIR | Ask a household question or continue from a decision. | Gemini can select relevant approved guidance and forecast evidence. Application code supplies the final wording, figures and sources. Responses identify their mode. |

Concentration bands in daily guidance are editorial planning cues. Official India AQI, personal dose and numerical medical risk cannot be inferred from these readings. Transport estimates use the documented US EPA illustrative gasoline-car tailpipe factor. Vehicle type, routes and occupancy matter for interpretation. [Sources and assumptions](docs/SOURCES.md)

## Architecture and privacy

One FastAPI service serves the native HTML/CSS/ES module interface. Typed provider adapters normalize observations and forecasts. A bounded memory cache reduces repeated lookups. Domain functions calculate all numerical comparisons and select household-specific options. Canvas 2D renders a seeded, illustrative urban landscape from cached geometry. [Architecture](docs/ARCHITECTURE.md) · [Design and graphics](docs/DESIGN_DNA.md)

The browser saves city and broad preferences locally. Requests send the relevant context to the backend. When Gemini is configured, it receives the current question, household options and selected environmental evidence. The application has no user accounts or conversation database. Keys are server-only. Assistant selections reference validated items. Authentication and quota failures end model attempts, while eligible transient failures, an unavailable model or malformed selections can trigger one alternate within the response budget.

## API

| Method and path | Purpose |
| --- | --- |
| GET /api/health | Service status |
| GET /api/cities?q=Pune | Indian city search |
| GET /api/air | Air context for name, region, latitude and longitude |
| POST /api/guidance | Daily guidance for location and household |
| POST /api/impact | Weekly allocation and optional avoided-trip calculation |
| POST /api/room | Room volume and target CADR |
| POST /api/ask | Contextual answer with mode, evidence, alternative and assumptions |

[Request and response models](app/domain/models.py)

## Verification and evaluation

```sh
python -m compileall -q app
python -m pytest
node --test tests/atmosphere.test.mjs
```

Node is only used for development tests. Keyboard-accessible dialogs, native forecast and sizing controls, text equivalents, selected-state labels and reduced-motion behavior support use without the illustrations. Try a Delhi parent planning cricket, a Bengaluru commuter sharing a ride and a Mumbai household sizing filtration. [Evaluator walkthrough](docs/QA_AND_DEMO.md)

## Deployment

Install `requirements.txt` and serve `app.main:app` with Uvicorn on the host-provided port. Configure optional API keys in the host secret manager. [Render configuration](render.yaml)

Check the deployed URL, provider availability, attribution, model quota and host timeouts before recording the demo. The prototype uses per-process caching and throttling. Public evaluation requires a working deployment, one public branch (`main`), tracked source under 10 MB, the demonstration and the development explanation.
