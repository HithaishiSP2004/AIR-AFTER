"""Server-only configuration. No secrets reach /web or the browser."""
import os
import re
from dotenv import load_dotenv

load_dotenv()

OPENAQ_API_KEY = os.getenv("OPENAQ_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
DEFAULT_MODEL = "gemini-3.8-flash"
BACKUP_MODEL = "gemini-3.5-flash-lite"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip()

# Fail configuration closed for unexpected custom model paths.
if not re.fullmatch(r"gemini-[a-z0-9][a-z0-9._-]{0,68}", GEMINI_MODEL):
    GEMINI_MODEL = DEFAULT_MODEL

def get_model_cascade() -> list[str]:
    return [GEMINI_MODEL, BACKUP_MODEL if GEMINI_MODEL != BACKUP_MODEL else DEFAULT_MODEL]
