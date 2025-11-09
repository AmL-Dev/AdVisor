"""
Configuration utilities for the Python backend.

This module centralises environment-driven settings so other parts of the
application can import a single source of truth. Keeping configuration logic in
one place makes it easier to manage defaults and validate required values.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings


def _load_env_file() -> None:
    """
    Load .env file from common locations:
    1. backend/.env
    2. AdVisor/.env (parent directory)
    3. advisor/.env (sibling directory where Next.js .env might be)
    """
    # Get the directory where this config file is located
    config_dir = Path(__file__).parent
    backend_dir = config_dir.parent
    advisor_dir = backend_dir.parent / "advisor"
    
    # Check in order of preference
    locations = [
        backend_dir / ".env",           # backend/.env
        backend_dir.parent / ".env",    # AdVisor/.env
        advisor_dir / ".env",           # advisor/.env
    ]
    
    for env_path in locations:
        if env_path.exists():
            load_dotenv(env_path, override=False)
            break


# Load .env file before creating Settings
_load_env_file()


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Attributes:
        google_api_key: API key used to authenticate requests against the
            Gemini / Google GenAI APIs.
        log_level: Desired log level for the FastAPI application.
        allowed_origins: Optional list of CORS origins allowed to call the
            backend.
    """

    google_api_key: str = Field(..., alias="GOOGLE_API_KEY")
    log_level: str = Field("INFO", alias="LOG_LEVEL")
    allowed_origins: Optional[str] = Field(None, alias="ALLOWED_ORIGINS")

    class Config:
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached instance of the application settings."""

    return Settings()


settings = get_settings()
