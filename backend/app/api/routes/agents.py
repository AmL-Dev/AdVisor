"""
API routes exposing AI agents to external orchestrators.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...agents.overall_critic import run_overall_critic
from ...agents.synthesizer import run_synthesizer
from ...agents.visual_style import run_visual_style
from ...schemas.critique import (
    AgentErrorResponse,
    OverallCriticRequest,
    OverallCriticResult,
    SynthesizerRequest,
    SynthesizerResult,
    VisualStyleRequest,
    VisualStyleResult,
)

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


@router.post(
    "/visual-style",
    response_model=VisualStyleResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def visual_style_endpoint(
    payload: VisualStyleRequest,
) -> VisualStyleResult:
    """
    Execute the visual style agent.

    This endpoint receives a base64-encoded video, brand logo, product image, and
    brand context, analyzes the visual style using Gemini, and returns a structured
    evaluation of visual consistency, aesthetic quality, and brand alignment.
    """

    try:
        return run_visual_style(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running visual style agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute visual style agent. Check backend logs.",
        )


@router.post(
    "/synthesizer",
    response_model=SynthesizerResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def synthesizer_endpoint(
    payload: SynthesizerRequest,
) -> SynthesizerResult:
    """
    Execute the synthesizer agent.

    This endpoint combines the outputs of upstream agents to generate a cohesive
    critique summary for the brand team.
    """

    try:
        return run_synthesizer(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running synthesizer agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute synthesizer agent. Check backend logs.",
        )
