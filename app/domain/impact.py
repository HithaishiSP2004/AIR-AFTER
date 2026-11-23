"""Conservative, inspectable calculators; estimates are not observed impact."""
from app.domain.models import JourneyInput, JourneyComparison, RoomInput, RoomResult

# Scope: gasoline passenger vehicle TAILPIPE CO2. Illustrative US vehicle average,
# NOT an India fleet factor. The UI labels the assumption; avoid CO2e claims.
# EPA: 400 grams CO2/mile ≈ 0.24855 kg CO2/km.
EPA_TYPICAL_CAR_KG_KM = 0.400 / 1.609344
EPA_SOURCE = "https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle"


def compare_journey(params: JourneyInput) -> JourneyComparison:
    vehicle_total = params.distance_km * params.trips_per_week * EPA_TYPICAL_CAR_KG_KM
    per_person = vehicle_total / params.occupants
    return JourneyComparison(
        distance_km=params.distance_km,
        solo_kg_co2_week=round(vehicle_total, 2),
        shared_kg_co2_person_week=round(per_person, 2),
        saved_kg_co2_person_week=round(vehicle_total - per_person, 2),
        occupants=params.occupants,
        factor_kg_co2_vehicle_km=round(EPA_TYPICAL_CAR_KG_KM, 5),
        factor_source=EPA_SOURCE,
        note=("Illustrative allocation of vehicle tailpipe CO₂, not measured local air "
              "pollution. Uses a US EPA average car factor, not a calibrated Indian "
              "fleet estimate. A shared ride only avoids emissions if it replaces "
              "separate vehicle trips; total vehicle emissions do not fall just "
              "because more people sit in the same car."),
    )


def size_air_cleaner(room: RoomInput) -> RoomResult:
    """CADR[m³/h] = room volume[m³] * target clean air changes[/hour].

    Approximate target, not a guarantee of real-world particle removal.
    Based on clean-air-change concepts; compare product AHAM CADR labels.
    """
    volume = room.area_m2 * room.ceiling_m
    return RoomResult(
        room_volume_m3=round(volume, 1),
        target_cadr_m3h=round(volume * room.clean_air_changes_hour),
        note=("Indicative smoke-particle CADR for the selected equivalent clean "
              "air changes per hour in a single room. Actual performance varies "
              "with placement, leaks and indoor sources. Check the product's "
              "smoke CADR and maintain the filter; this is not an indoor AQI estimate."),
    )
