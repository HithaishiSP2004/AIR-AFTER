from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.domain.models import Location, AirSnapshot, Evidence
from app import main

client=TestClient(app)
LOC=Location(name='New Delhi',region='Delhi',latitude=28.6139,longitude=77.209)

async def fake_air(location):
    now=datetime(2026,11,23,9,0,tzinfo=timezone.utc)
    e=Evidence(kind='model',provider='test fixture',pollutant='pm2_5',value=41.2,measured_at=now,
               source_url='https://open-meteo.com/en/docs/air-quality-api')
    return AirSnapshot(location=location,primary=e,modeled=e,fetched_at=now)


def test_frontend_and_security_headers():
    response=client.get('/')
    assert response.status_code==200
    assert 'AIR / AFTER' in response.text
    assert "'self'" in response.headers['Content-Security-Policy']
    assert response.headers['X-Frame-Options']=='DENY'
    assert client.get('/assets/styles.css').status_code==200
    assert client.get('/api/health').json()['status']=='ok'


def test_api_inputs_validated():
    assert client.get("/api/air", params={**LOC.model_dump(), "name": "   "}).status_code == 422
    assert client.get('/api/air?latitude=500&longitude=500&name=test').status_code==422
    assert client.post('/api/impact',json={'distance_km':-3,'occupants':2,'trips_per_week':2}).status_code==422
    assert client.post('/api/room',json={'area_m2':-3,'ceiling_m':2.8}).status_code==422
    assert client.post('/api/ask',json={'question':'x','location':LOC.model_dump()}).status_code==422


def test_impact_endpoint():
    response=client.post('/api/impact',json={'distance_km':12,'trips_per_week':10,'occupants':3})
    assert response.status_code==200
    body=response.json()
    assert body['solo_kg_co2_week']>body['shared_kg_co2_person_week']
    assert 'per-person' in body['note'] or 'vehicle tailpipe' in body['note']


def test_room_endpoint():
    response=client.post('/api/room',json={'area_m2':20,'ceiling_m':2.8,'clean_air_changes_hour':4})
    assert response.json()['target_cadr_m3h']==224


def test_personalized_guidance(monkeypatch):
    monkeypatch.setattr(main,'get_air',fake_air)
    base={'location':LOC.model_dump()}
    child=client.post('/api/guidance',json={**base,'household':{'children':True}})
    adult=client.post('/api/guidance',json={**base,'household':{'children':False}})
    assert child.status_code==200 and adult.status_code==200
    assert child.json()['summary'] != adult.json()['summary']


def test_rules_assistant_labels_itself(monkeypatch):
    from app import config
    monkeypatch.setattr(config,'GEMINI_API_KEY','')
    monkeypatch.setattr(main,'get_air',fake_air)
    response=client.post('/api/ask',json={'question':'Should my child play outside?','location':LOC.model_dump(),
        'household':{'children':True}})
    assert response.status_code==200
    data=response.json()
    assert data['mode']=='rules'
    assert 'no Gemini' in data['source']
    assert data['actions']


def test_external_data_api_can_succeed_without_gemini(monkeypatch):
    monkeypatch.setattr(main,'get_air',fake_air)
    response=client.get('/api/air?name=New%20Delhi&region=Delhi&latitude=28.6139&longitude=77.2090')
    assert response.status_code==200
    assert response.json()['primary']['kind']=='model'
