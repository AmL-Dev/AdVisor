"""
FastAPI application entry-point.
"""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes.agents import router as agents_router
from .config import settings

app = FastAPI(
    title="AdVisor Agents API",
    version="0.1.0",
    description="Backend services exposing AI agents for the AdVisor workflow.",
)


def _configure_cors(application: FastAPI) -> None:
    """Configure CORS middleware based on environment settings."""

    if not settings.allowed_origins:
        return

    origins: List[str] = [
        origin.strip()
        for origin in settings.allowed_origins.split(",")
        if origin.strip()
    ]

    if not origins:
        return

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


_configure_cors(app)

app.include_router(agents_router)


@app.get("/healthz")
async def health_check() -> dict[str, str]:
    """Simple health endpoint used for readiness probes."""

    return {"status": "ok"}
