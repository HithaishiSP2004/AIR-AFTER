from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError
from app.domain.models import Location, Household, Evidence, AirSnapshot, JourneyInput, RoomInput, AskInput
from app.domain.impact import compare_journey, size_air_cleaner, EPA_TYPICAL_CAR_KG_KM
from app.domain.guidance import daily_guidance
from app.air_service import choose_primary

LOC = Location(name='New Delhi', region='Delhi', latitude=28.6139, longitude=77.209)
NOW = datetime(2026,11,23,9,0,tzinfo=timezone.utc)


def evidence(value=80,kind='model', stale=False):
    return Evidence(kind=kind,provider='test',pollutant='pm2_5',value=value,
                    measured_at=NOW,stale=stale,source_url='https://open-meteo.com')


def snap(reading):
    return AirSnapshot(location=LOC,primary=reading,modeled=reading, fetched_at=NOW)


def test_journey_shares_allocation_without_claiming_total_avoidance():
    result=compare_journey(JourneyInput(distance_km=10,trips_per_week=10,occupants=4))
    assert result.solo_kg_co2_week == round(100*EPA_TYPICAL_CAR_KG_KM,2)
    assert result.shared_kg_co2_person_week == round((100*EPA_TYPICAL_CAR_KG_KM)/4,2)
    assert 'do not fall' in result.note
    assert result.factor_source.startswith('https://www.epa.gov/')


def test_single_occupant_has_no_share_difference():
    result=compare_journey(JourneyInput(distance_km=10,trips_per_week=5,occupants=1))
    assert result.saved_kg_co2_person_week == 0


def test_room_cadr_is_volume_times_clean_air_changes():
    result=size_air_cleaner(RoomInput(area_m2=20,ceiling_m=2.8,clean_air_changes_hour=4))
    assert result.room_volume_m3 == 56
    assert result.target_cadr_m3h == 224
    assert 'not an indoor AQI' in result.note


def test_invalid_inputs_rejected():
    with pytest.raises(ValidationError): JourneyInput(distance_km=-1,occupants=1,trips_per_week=1)
    with pytest.raises(ValidationError): Location(name='Outside',latitude=40,longitude=0)
    with pytest.raises(ValidationError): AskInput(question='x',location=LOC)
    with pytest.raises(ValidationError): RoomInput(area_m2=250,ceiling_m=3)


def test_station_observation_preferred_over_model():
    station=evidence(41,kind='observation');model=evidence(88)
    assert choose_primary([station],model,NOW)==station


def test_stale_station_not_preferred():
    old=evidence(41,kind='observation',stale=True);model=evidence(88)
    assert choose_primary([old],model,NOW)==model


def test_unavailable_model_never_fabricates_current():
    old=evidence(41,kind='observation',stale=True)
    assert choose_primary([old],None,NOW) is None


def test_future_or_old_model_rejected():
    future=evidence(50).model_copy(update={'measured_at':NOW+timedelta(days=3)})
    old=evidence(50).model_copy(update={'measured_at':NOW-timedelta(days=3)})
    assert choose_primary([],future,NOW) is None
    assert choose_primary([],old,NOW) is None


def test_family_guidance_differs_from_individual():
    family=daily_guidance(snap(evidence()),Household(children=True))
    individual=daily_guidance(snap(evidence()),Household(children=False))
    assert 'children' in family['summary']
    assert 'children' not in individual['summary']
    assert family['title']==individual['title']  # same regional condition, different personal explanation


def test_unknown_data_returns_disclosure():
    recommendation=daily_guidance(snap(None),Household())
    assert 'could not confirm' in recommendation['summary']
    assert 'No reliable' in recommendation['confidence']


def test_commuting_and_purifier_change_action_plan():
    driver=daily_guidance(snap(evidence(40)),Household(commuting='car',purifier=False))
    cyclist=daily_guidance(snap(evidence(40)),Household(commuting='cycle',purifier=True))
    assert driver['actions'][2] != cyclist['actions'][2]
    assert 'filter' in cyclist['actions'][1]
    assert 'filter' not in driver['actions'][1]
