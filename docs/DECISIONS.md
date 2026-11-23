# Engineering decisions (concise ADR)

**ADR-001 — FastAPI + native UI instead of Next.js:** Chosen to ship a truly runnable, testable, <10MB foundation without a Node build or a generic component system. Typed server contracts and zero frontend dependencies preserve efficiency. A later replatform would need a substantial demonstrated benefit and owner approval.

**ADR-002 — PM2.5 concentration, not computed India AQI:** Real India AQI requires a defined multi-pollutant methodology and averaging rules. We show source-separated concentrations to avoid presenting misleading AQI from an instantaneous point.

**ADR-003 — Model fallback always labeled:** CAMS can provide area estimates when OpenAQ coverage is missing; model ≠ station and is never visually labeled live sensor.

**ADR-004 — Gemini is an interpretation layer:** Deterministic data acquisition, input validation and calculations come first. Gemini is optional, has no tool authority, and is marked as Gemini or explicit rules fallback.

**ADR-005 — Client-local context:** No login/database is needed for broad preferences. Local storage can be cleared. No names, diagnoses, or precise-address retention.

**ADR-006 — Original Canvas rather than imported animation:** The living atmosphere is an original, deterministic, accessible metaphor. A procedural Canvas with capped particles avoids heavy 3D runtimes.

**ADR-007 — No manufactured proof:** Visual previews generated during the foundation build use mocked browser fixture values **only for screenshot testing**; they are not embedded as actual app data.
