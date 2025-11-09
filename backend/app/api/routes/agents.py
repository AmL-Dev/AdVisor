"""
API routes exposing AI agents to external orchestrators.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...agents.overall_critic import run_overall_critic
from ...schemas.critique import AgentErrorResponse, OverallCriticRequest, OverallCriticResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post(
    "/overall-critic",
    response_model=OverallCriticResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def overall_critic_endpoint(
    payload: OverallCriticRequest,
) -> OverallCriticResult:
    """
    Execute the overall critic agent.

    This endpoint receives a base64-encoded video and brand context, forwards
    them to the Gemini-powered critic, and returns the structured evaluation.
    """

    try:
        return run_overall_critic(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running overall critic agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute overall critic agent. Check backend logs.",
        )
