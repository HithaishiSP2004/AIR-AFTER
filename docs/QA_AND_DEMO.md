# QA scenarios and evaluator walkthrough

## Three reproducible personas

- Parent, **New Delhi**: open My Household, select `Family` + Children, choose Delhi. Inspect data source and timestamp, daily activity guidance, then `Decision Studio → Playtime`. Ask: `Should my child play cricket outside this evening?` Interpret AI/rules mode; do not expect an exact medical risk percentage.
- Professional, **Bengaluru**: search/select city. In Decision Studio change one-way distance, journeys/week and occupants. Explain the difference between vehicle emissions and an illustrative per-person allocation, and how route exposure is not the same as emissions.
- Household, **Mumbai**: select city. In Home Air Lab adjust room m², ceiling height and equivalent clean-air changes. Observe CADR update and guidance on indoor smoke sources, filtration and thoughtful ventilation. Do not confuse CADR with measured indoor PM2.5.

## Required tests before first submission

- [ ] `python -m pytest -q` passes.
- [ ] `python -m compileall -q app` passes.
- [ ] `uvicorn app.main:app --reload` serves the site and `/api/health`.
- [ ] Real Open-Meteo values appear at a real time stamp on deployed site; if unavailable, clear no-data state.
- [ ] OpenAQ works with a user-supplied key; if not connected, model source remains accurately labeled.
- [ ] City search covers an Indian town beyond preset cities; no Delhi measurement mistakenly appears for another city.
- [ ] Household changes produce different personalized guidance.
- [ ] Decision sliders, errands scenario, playtime scenario work.
- [ ] Room CADR updates without an indoor AQI claim.
- [ ] Ask AIR responds with Gemini key; without it, rules mode visibly disclosed.
- [ ] API failures never display canned live data.
- [ ] 390px / 768px / 1440px; no overflow; keyboard navigation and visible focus.
- [ ] Reduced-motion mode pauses animation.
- [ ] README, URL, LinkedIn development post, demo video and public GitHub repo are complete.
- [ ] Repo under 10MB, exactly one branch, `git status` clean, no secrets committed.

## Demo video (90–150 seconds)

1. 0–15s: Explain the problem and the **observed vs modeled** evidence distinction.
2. 15–40s: Select a city, adjust the household context, show daily adaptation.
3. 40–70s: Show Decision Studio comparison; explain why per-person allocation is not direct emissions avoided.
4. 70–90s: Show Home Air Lab CADR response and safety caveat.
5. 90–120s: Ask a contextual question; show mode and source provenance; handle an unavailable provider honestly.
6. Final: Show source code, repository structure and test output briefly.

**Do not record with mocked data and imply it is a live provider response.** If recording a fixture-only walkthrough, visibly label it simulated.
