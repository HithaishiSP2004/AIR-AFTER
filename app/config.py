"""Server-only configuration. No secrets reach /web or the browser."""
import os
from dotenv import load_dotenv

load_dotenv()

OPENAQ_API_KEY = os.getenv("OPENAQ_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

# Fail configuration closed for unexpected custom model paths.
if not GEMINI_MODEL.replace("-", "").replace(".", "").replace("_", "").isalnum():
    GEMINI_MODEL = "gemini-3.8-flash"

# Model cascade ordered by recency and high capacity (15 RPM / 500 RPD) with resilient fallbacks
BACKUP_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
]

def get_model_cascade() -> list[str]:
    cascade = [GEMINI_MODEL]
    for model in BACKUP_MODELS:
        if model not in cascade:
            cascade.append(model)
    return cascade
