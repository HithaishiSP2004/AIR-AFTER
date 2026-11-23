"""Transparent guidance policy. Not a diagnostic or regulatory AQI engine."""
from dataclasses import dataclass

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
        title = "Check the air before making plans."
        summary = "We could not confirm a sufficiently recent local PM2.5 value. Check the latest official advisory before planning long outdoor activity."
        actions = ["Review your local advisory", "Keep a flexible indoor option", ""]
        source = None
    else:
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
    if household.children:
        actions[0] = "Keep an indoor play option ready and review the outlook before outdoor sports"
    elif household.older_adults:
        actions[0] = "Plan a flexible walking time and a shorter alternative for older household members"
    if household.children and household.older_adults:
        actions[0] = "Plan flexible outdoor time for children and older adults, with an indoor alternative"
    if household.purifier:
        actions[1] = "Use appropriately sized particle filtration and maintain the filter"
    if household.audience == "community":
        summary += " For a community decision, share the data timestamp and avoid one-size-fits-all activity advice."
    if household.sensitive:
        summary += " For individual medical needs, follow the person's clinician advice."
    return {
        "eyebrow": ("YOUR DAILY ADJUSTMENT" if source else "DATA CHECK"), "title": title, "summary": summary,
        "actions": actions, "confidence": (f"Based on {source}; qualitative guidance, not a health-risk score" if source else "No reliable recent measurement or estimate"),
    }


@dataclass(frozen=True)
class Decision:
    title: str
    reason: str
    actions: tuple[str, str, str]
    alternative: str
    assumption: str


def decisions(snapshot: AirSnapshot, household: Household) -> dict[str, Decision]:
    """Bounded choices shared by the deterministic and Gemini selection paths."""
    primary = snapshot.primary
    pm = primary.value if primary and not primary.stale else None
    play_action = (
        "Keep an indoor game ready while you check the local advisory." if pm is None else
        "Move strenuous play indoors or choose a shorter, gentler session." if pm >= 35 else
        "Check the outlook for playtime and keep the session flexible."
    )
    routine = daily_guidance(snapshot, household)
    commute_action = routine["actions"][2]
    filtration = ("Check your purifier's smoke CADR and filter maintenance schedule."
                  if household.purifier else "Start with smoke sources before spending money on a purifier.")
    return {
        "play": Decision(play_action,
            "The intensity, duration and location of play all affect the decision. Outdoor conditions now may differ by evening.",
            ("Check the hourly outlook before leaving.", "Offer indoor movement if plans change.", "Choose a play area away from heavy traffic when practical."),
            "A shorter, gentler game gives the family another option.", "The app has no reading at the playing field."),
        "commute": Decision("Compare the journeys you can actually take.",
            "Sharing a car divides its tailpipe emissions among riders. In the comparison, removing vehicle kilometres reduces the estimated tailpipe total.",
            (commute_action, "Compare actual route length and occupancy in Decision Studio.", "Weigh exertion, time outdoors and nearby traffic separately."),
            "Compare public transport or combine two errands into one trip.", "Street-level conditions and transit availability need a local check."),
        "home": Decision("Start with the sources in your room.",
            "Smoke from cooking and indoor burning can contribute to indoor particles. The outdoor reading alone cannot describe the air in your bedroom.",
            ("Avoid indoor burning and smoking.", "Use kitchen extraction when available.", filtration),
            "Use Home Air Lab to compare the room volume against a cleaner's smoke CADR.", "Indoor concentration and ventilation have not been measured."),
        "budget": Decision("Start with changes that cost little.",
            "Removing a source of indoor smoke and combining necessary vehicle trips address different parts of your routine.",
            ("Skip incense or other indoor burning.", "Group errands when the combined route is shorter.", "Use existing kitchen extraction when cooking."),
            "If someone already makes the trip, check whether sharing it would replace another vehicle journey.",
            "Savings depend on which trips your household actually replaces."),
        "community": Decision("Give residents a flexible activity plan.",
            "A common, time-stamped update helps residents choose an activity that fits their own circumstances.",
            ("Share the latest official advisory with its time.", "Offer a lower-intensity or indoor event option.", "Coordinate essential trips where residents can replace separate journeys."),
            "Postpone a strenuous outdoor event when local guidance calls for it.", "Conditions can differ between the station, streets and individual homes."),
        "routine": Decision("Plan the next activity around the available evidence.",
            routine["summary"], tuple(routine["actions"]),
            "Choose a flexible time or indoor activity if the local outlook changes.", "A city reading cannot establish anyone's personal exposure."),
    }


def select_topic(question: str, scenario: str | None, household: Household) -> str:
    words = question.casefold()
    for topic, terms in (
        ("budget", ("budget", "cost", "money", "afford", "cheap")),
        ("community", ("community", "apartment association", "residents")),
        ("home", ("indoor", "home", "inside", "purifier", "window", "cook", "room", "filter")),
        ("play", ("child", "kid", "school", "play", "cricket", "football", "sport")),
        ("commute", ("commut", "drive", "bus", "metro", "cycl", "work", "travel", "car", "ride", "errand")),
    ):
        if any(term in words for term in terms):
            return topic
    if scenario:
        return "commute" if scenario == "errands" else scenario
    return "community" if household.audience == "community" else "routine"
