"""Typed contracts shared by routes, rules and external-data adapters."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class Location(StrictModel):
    name: str = Field(min_length=2, max_length=90)
    region: str = Field(default="", max_length=90)
    latitude: float = Field(ge=6, le=38)
    longitude: float = Field(ge=67, le=98)

class Household(StrictModel):
    audience: Literal["individual", "family", "community"] = "family"
    children: bool = True
    older_adults: bool = False
    sensitive: bool = False
    commuting: Literal["car", "carpool", "transit", "walk", "cycle", "mixed"] = "mixed"
    purifier: bool = False

class Evidence(StrictModel):
    kind: Literal["observation", "model"]
    provider: str
    pollutant: Literal["pm2_5", "pm10"]
    value: float = Field(ge=0, le=3000)
    unit: str = "µg/m³"
    measured_at: datetime
    station: str | None = None
    distance_km: float | None = None
    stale: bool = False
    source_url: str

class ForecastPoint(StrictModel):
    time: datetime
    pm2_5: float | None = None
    pm10: float | None = None

class AirSnapshot(StrictModel):
    location: Location
    primary: Evidence | None
    observed: list[Evidence] = Field(default_factory=list)
    modeled: Evidence | None = None
    forecast: list[ForecastPoint] = Field(default_factory=list)
    fetched_at: datetime
    warnings: list[str] = Field(default_factory=list)
    attribution: str = "Open-Meteo / Copernicus Atmosphere Monitoring Service (CAMS)"

class AskInput(StrictModel):
    question: str = Field(min_length=3, max_length=450)
    location: Location
    household: Household = Field(default_factory=Household)

class AssistantReply(StrictModel):
    mode: Literal["gemini", "rules"]
    title: str = Field(min_length=4, max_length=120)
    answer: str = Field(min_length=10, max_length=1500)
    actions: list[str] = Field(min_length=1, max_length=4)
    evidence: str = Field(max_length=400)
    caveat: str = Field(max_length=600)
    source: str = Field(max_length=180)

class JourneyInput(StrictModel):
    distance_km: float = Field(ge=0.5, le=150)
    trips_per_week: int = Field(ge=1, le=14)
    occupants: int = Field(ge=1, le=7)

class JourneyComparison(StrictModel):
    distance_km: float
    solo_kg_co2_week: float
    shared_kg_co2_person_week: float
    saved_kg_co2_person_week: float
    occupants: int
    factor_kg_co2_vehicle_km: float
    factor_source: str
    note: str

class RoomInput(StrictModel):
    area_m2: float = Field(ge=5, le=180)
    ceiling_m: float = Field(ge=2, le=5)
    clean_air_changes_hour: float = Field(default=4, ge=2, le=6)

class RoomResult(StrictModel):
    room_volume_m3: float
    target_cadr_m3h: float
    note: str

class CityResult(StrictModel):
    name: str
    region: str
    latitude: float
    longitude: float

class CitySearchResult(StrictModel):
    results: list[CityResult]

class ContextInput(StrictModel):
    location: Location
    household: Household = Field(default_factory=Household)
