from datetime import datetime,timezone,timedelta
import asyncio
import pytest
from app.providers.openmeteo import parse_openmeteo
from app.providers.openaq import parse_latest, parse_stations
from app.providers.http import ProviderError

NOW=datetime(2026,11,23,9,0,tzinfo=timezone.utc)


def test_model_has_proper_provenance_and_hourly():
    modeled, points=parse_openmeteo({'current':{'time':'2026-11-23T09:00','pm2_5':44.3,'pm10':93.7},
                                     'hourly':{'time':['2026-11-23T09:00','2026-11-23T10:00'],
                                               'pm2_5':[44.3,42.1],'pm10':[93.7,91]}})
    assert modeled.kind=='model'
    assert modeled.value==44.3
    assert modeled.measured_at.tzinfo==timezone.utc
    assert len(points)==2 and points[1].pm2_5==42.1


def test_model_null_pm_does_not_become_zero():
    model,points=parse_openmeteo({'current':{'time':'2026-11-23T09:00','pm2_5':None},
                                   'hourly':{'time':['2026-11-23T09:00'], 'pm2_5':[None], 'pm10':[None]}})
    assert model is None
    assert points[0].pm2_5 is None


def test_model_rejects_ill_formed_payload():
    with pytest.raises(ProviderError): parse_openmeteo('not json')


def test_station_sensor_map_uses_units_and_pollutant_names():
    stations=parse_stations({'results':[
        {'id':51,'name':'Station A','country':{'code':'IN'},'distance':1500,'sensors':[
            {'id':4,'parameter':{'name':'pm25','units':'µg/m³'}},
            {'id':5,'parameter':{'name':'pm10','units':'µg/m³'}},
            {'id':6,'parameter':{'name':'co','units':'ppm'}},
        ]},
        {'id':52,'name':'Not India','country':{'code':'US'},'sensors':[{'id':7,'parameter':{'name':'pm25','units':'µg/m³'}}]},
    ]})
    assert len(stations)==1
    assert stations[0]['sensors']=={4:'pm2_5',5:'pm10'}


def test_stale_observation_is_flagged_not_silently_treated_current():
    station={'id':51,'name':'Station A','sensors':{4:'pm2_5'},'distance':1500}
    readings=parse_latest({'results':[{'sensorsId':4,'value':72,'datetime':{'utc':'2026-11-22T23:00:00Z'}}]},station,NOW)
    assert readings[0].kind=='observation' and readings[0].stale
    assert readings[0].distance_km==1.5


def test_unrecognized_sensor_and_negative_values_are_ignored():
    station={'id':51,'name':'Station A','sensors':{4:'pm2_5'},'distance':1500}
    data={'results':[{'sensorsId':8,'value':40,'datetime':{'utc':'2026-11-23T09:00:00Z'}},
                     {'sensorsId':4,'value':-20,'datetime':{'utc':'2026-11-23T09:00:00Z'}}]}
    assert parse_latest(data,station,NOW)==[]


def test_hourly_forecast_preserves_missing_values_and_sorts_with_time_offsets():
    _, points = parse_openmeteo({
        'hourly': {'time': ['2026-11-23T14:30+05:30', '2026-11-23T08:00Z'],
                   'pm2_5': [42.0]},
        'hourly_units': {'pm2_5': 'μg/m³'}})
    assert [p.time.hour for p in points] == [8, 9]
    assert [p.pm2_5 for p in points] == [None, 42.0]
    assert all(p.pm10 is None for p in points)


def test_model_with_explicit_wrong_units_cannot_be_displayed_as_concentration():
    model, points = parse_openmeteo({
        'current': {'time': '2026-11-23T09:00', 'pm2_5': 20},
        'current_units': {'pm2_5': 'ppm'},
        'hourly': {'time': ['2026-11-23T09:00'], 'pm2_5': [20], 'pm10': [50]},
        'hourly_units': {'pm2_5': 'ppm', 'pm10': 'µg/m³'}})
    assert model is None
    assert points[0].pm2_5 is None and points[0].pm10 == 50


def test_station_skips_ambiguous_time_and_malformed_sensor_identifier():
    station = {'id': 51, 'name': 'Fixture station', 'sensors': {4: 'pm2_5'}}
    rows = [{'sensorsId': [], 'value': 10, 'datetime': {'utc':'2026-11-23T09:00Z'}},
            {'sensorsId': 4, 'value': 10, 'datetime': {'utc':'2026-11-23T09:00'}}]
    assert parse_latest({'results':rows}, station, NOW) == []


def test_search_only_returns_places_accepted_by_location_routes(monkeypatch):
    from app.providers import geocoding
    rows = [
        {'name': 'Fixture town', 'latitude': 25, 'longitude': 78, 'country_code':'IN'},
        {'name': 'Invalid fixture point', 'latitude': 500, 'longitude': 78, 'country_code':'IN'},
        {'name': 'Outside search country', 'latitude': 25, 'longitude': 78, 'country_code':'XX'}]

    async def response(url):
        return {'results': rows}

    monkeypatch.setattr(geocoding, 'fetch_json', response)
    assert [r.name for r in asyncio.run(geocoding.search_cities('Fixture'))] == ['Fixture town']


def test_station_provider_distinguishes_outage_from_empty_coverage(monkeypatch):
    from app.domain.models import Location
    from app.providers import openaq
    location = Location(name='Fixture town', latitude=25, longitude=78)
    station = {'id':51, 'country':{'code':'IN'}, 'sensors':[
        {'id':4, 'parameter':{'name':'pm25', 'units':'µg/m³'}}]}

    async def unavailable(url, **kwargs):
        if '/latest' in url:
            raise ProviderError('Fixture outage')
        return {'results':[station]}

    async def empty(url, **kwargs):
        return {'results':[]}

    monkeypatch.setattr(openaq, 'OPENAQ_API_KEY', 'fixture')
    monkeypatch.setattr(openaq, 'fetch_json', unavailable)
    with pytest.raises(ProviderError):
        asyncio.run(openaq.get_observations(location, NOW))
    monkeypatch.setattr(openaq, 'fetch_json', empty)
    assert asyncio.run(openaq.get_observations(location, NOW)) == []
