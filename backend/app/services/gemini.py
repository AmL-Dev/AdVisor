"""
Helper utilities for interacting with the Google GenAI Python SDK.
"""

from functools import lru_cache
from typing import Optional

from google import genai

from ..config import settings


@lru_cache(maxsize=1)
def get_genai_client(api_key: Optional[str] = None) -> genai.Client:
    """
    Return a cached Google GenAI client.

    Args:
        api_key: Optional override for the API key. When omitted the value from
            application settings is used.
    """

    key = api_key or settings.google_api_key
    if not key:
        raise ValueError("GOOGLE_API_KEY is required to call GenAI services")

    return genai.Client(api_key=key)
