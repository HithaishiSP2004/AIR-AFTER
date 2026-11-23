# Sources, assumptions and evidence discipline

Checked against public provider documentation on 2026-11-23. Sources are references, not endorsement.

1. **OpenAQ API v3** — https://docs.openaq.org/ ; https://docs.openaq.org/resources/latest ; https://docs.openaq.org/api/operations/locations_get_v3_locations_get . Requires an API key. `latest` is most recent in the stored sensor series, not guaranteed to represent continuous live coverage. Location radius maximum 25km. Pollutant parameters and units are mapped from sensor metadata. Do not combine different sensor readings into a fabricated official city AQI.
2. **Open-Meteo Air Quality / CAMS** — https://open-meteo.com/en/docs/air-quality-api . The non-station `current` and `hourly` variables are **atmospheric model data** and should be explicitly labeled as such. Attribution: Open-Meteo and Copernicus Atmosphere Monitoring Service (CAMS). Check terms and plans before high-volume/commercial deployment.
3. **Open-Meteo geocoding** — https://open-meteo.com/en/docs/geocoding-api . Search with `countryCode=IN`; the UI also has independently labeled city shortcuts.
4. **India National AQI** — https://app.cpcbccr.com/ccr_docs/About_AQI.pdf . Official national AQI requires a prescribed multi-pollutant method and averaging rules. Our app displays **PM2.5 µg/m³**, NOT an IND-AQI number, to avoid miscalculated AQI.
5. **US EPA, typical passenger car CO₂** — https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle . Assumed 400g CO₂/mile, converted to about 0.24855kg CO₂/vehicle-km. This is a *US typical gasoline car illustrative factor*, NOT calibrated to the India fleet. `app/domain/impact.py` calculates vehicle totals and per-person allocation; it does not claim allocations automatically avoid emissions. This is *tailpipe CO₂*, not total CO₂e or local PM avoided.
6. **US EPA Guide to Air Cleaners** — https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home . CADR varies by room and purifier; `room volume * selected equivalent clean-air changes/hour` is an **illustrative** sizing target, not a certified recommendation, measured room AQI, or guarantee of filtration.
7. **WHO personal air pollution interventions** — https://www.who.int/news-room/questions-and-answers/item/air-pollution-personal-interventions-and-risk-communication . Exposure context and vulnerable groups matter. Avoid medical treatment advice or invented exact health-risk reduction.
8. **Gemini structured outputs** — https://ai.google.dev/gemini-api/docs/structured-output . When configured, AI receives already validated evidence and returns a typed explanation. Do not give the model authority to create observations, source citations or impact data.

### Qualitative concentration communication bands

`app/domain/guidance.py` uses *editorial* PM2.5 concentration bands (`<15`, `<35`, `<75`, `>=75` µg/m³) for differential phrasing. They are **not a government AQI, not a safe/unsafe medical threshold, and not a scientifically calibrated risk model**. If we improve this later, use a properly cited health-communication standard, test localization and explicitly preserve these caveats.

### Known methodological limits

Weather, activity intensity, street-level variation and ventilation are not directly captured by a city model value. A household's indoor AQI cannot be inferred from outside PM2.5. Carpool allocation is not necessarily emissions avoided. Route distances in the errand scenario are user input, not geocoded road routes. AI cannot substitute for physician advice or local public alerts.
