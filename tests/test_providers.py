from datetime import datetime,timezone,timedelta
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
