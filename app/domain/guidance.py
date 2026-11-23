"""Transparent guidance policy. Not a diagnostic or regulatory AQI engine."""
from app.domain.models import AirSnapshot, Household

# These are editorial concentration bands for communication only. They are NOT
# national AQI thresholds or personal health-risk cutoffs. No 'safe' declaration.
def describe_concentration(pm: float | None) -> str:
    if pm is None: return "unknown"
    if pm < 15: return "lower"
    if pm < 35: return "elevated"
    if pm < 75: return "high"
    return "very high"


def daily_guidance(snapshot: AirSnapshot, household: Household) -> dict[str, str | list[str]]:
    pm = snapshot.primary.value if snapshot.primary and not snapshot.primary.stale else None
    band = describe_concentration(pm)
    group = "children and older adults" if household.children and household.older_adults else (
        "children" if household.children else "older adults" if household.older_adults else "people")
    if pm is None:
        return {
            "eyebrow": "DATA CHECK",
            "title": "Check the air before making plans.",
            "summary": "We could not confirm a sufficiently recent local PM2.5 value. Consider the latest official advisory before planning long outdoor activity.",
            "actions": ["Review the data source and timestamp", "Choose flexible indoor options", "Try another nearby location"],
            "confidence": "No reliable recent measurement or estimate",
        }
    source = "nearby station measurement" if snapshot.primary.kind == "observation" else "atmospheric model estimate"
    if band in ("high", "very high"):
        title = "Make the outside optional today."
        summary = (f"The available {source} indicates {band} PM2.5 ({pm:g} µg/m³). "
                   f"Consider shorter, less strenuous outdoor activities for {group}; "
                   "plan a practical indoor alternative when possible.")
        actions = ["Reconsider strenuous outdoor exercise", "Reduce indoor smoke and cooking fumes", "Compare essential trips before leaving"]
    elif band == "elevated":
        title = "A few small changes may help."
        summary = (f"The available {source} indicates elevated PM2.5 ({pm:g} µg/m³). "
                   f"For {group}, consider activity intensity and time outside when planning the day.")
        actions = ["Check the forecast before outdoor plans", "Choose less traffic-heavy routes where practical", "Control indoor particle sources"]
    else:
        title = "Make room for a thoughtful routine."
        summary = (f"The available {source} shows relatively lower PM2.5 ({pm:g} µg/m³). "
                   "Conditions can change; consider local advisories and household needs.")
        actions = ["Keep an eye on the hourly forecast", "Combine short errands when feasible", "Keep indoor smoke sources controlled"]
    # Lifestyle influences what is practical; emissions and exposure are separate.
    commute_actions = {
        "car": "Combine vehicle trips or explore sharing a ride when practical",
        "carpool": "Coordinate a shared trip only if it replaces separate car journeys",
        "transit": "Check real transit availability and consider lower-traffic access routes",
        "walk": "Consider avoiding heavily trafficked streets on longer walking journeys",
        "cycle": "Consider route and exertion when cycling near busy roads",
        "mixed": "Compare essential trip options and avoid unnecessary journeys",
    }
    actions[2] = commute_actions[household.commuting]
    if household.purifier:
        actions[1] = "Use appropriately sized particle filtration and maintain the filter"
    if household.audience == "community":
        summary += " For a community decision, share the data timestamp and avoid one-size-fits-all activity advice."
    if household.sensitive:
        summary += " For individual medical needs, follow the person's clinician advice."
    return {
        "eyebrow": "YOUR DAILY ADJUSTMENT", "title": title, "summary": summary,
        "actions": actions, "confidence": f"Based on {source}; qualitative guidance, not a health-risk score",
    }


def rules_reply(question: str, snapshot: AirSnapshot, household: Household) -> tuple[str, str, list[str]]:
    q = question.lower()
    pm = snapshot.primary.value if snapshot.primary and not snapshot.primary.stale else None
    high = pm is not None and pm >= 35
    if any(w in q for w in ["child", "kid", "school", "play", "cricket", "football", "sport"]):
        return ("Outdoor play, thoughtfully planned",
                "A young person's activity intensity and time outdoors matter. " +
                ("With elevated particulate concentrations, consider moving strenuous play indoors or shortening the session." if high else
                 "Review the latest measurements and local guidance before deciding whether to move a session indoors."),
                ["Check the hour-by-hour outlook", "Offer an indoor movement option", "Avoid high-traffic play areas where possible"])
    if any(w in q for w in ["home", "inside", "purifier", "window", "cook", "room"]):
        return ("Make the indoor air work for you",
                "Indoor air depends on cooking, cleaning, infiltration, and ventilation; outdoor readings cannot tell us your indoor concentration. "
                "Start by reducing smoke sources, using kitchen extraction where possible, and choosing correctly sized particle filtration.",
                ["Avoid incense and indoor burning", "Use cooking extraction where practical", "Check purifier CADR and maintain its filter" if household.purifier else "Explore appropriately sized filtration if practical"])
    if any(w in q for w in ["commute", "drive", "bus", "metro", "cycle", "work", "travel"]):
        return ("A commute has two impacts",
                "Lower-emission travel is valuable, but outdoor exposure and route conditions are a separate consideration. "
                "Compare the practical route, time, ventilation, and transport alternatives rather than assuming one option minimizes both.",
                ["Consider combining trips", "Compare vehicle occupancy", "Avoid assuming the greenest trip always has the least exposure"])
    return ("A decision grounded in today's air",
            "Use local, time-stamped pollution information alongside your household's needs. "
            "A modeled forecast is not a measured reading, and no single number captures everyone's exposure.",
            ["Review the source and timestamp", "Adjust outdoor activity if conditions worsen", "Reduce indoor pollution sources"])
