"""
API routes exposing AI agents to external orchestrators.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ...agents.overall_critic import run_overall_critic
from ...agents.synthesizer import run_synthesizer
from ...agents.visual_style import run_visual_style
from ...agents.frame_extractor import run_frame_extraction
from ...agents.logo_detector import run_logo_detection
from ...agents.color_harmony import run_color_harmony
from ...schemas.critique import (
    AgentErrorResponse,
    FrameExtractionResult,
    OverallCriticRequest,
    OverallCriticResult,
    SynthesizerRequest,
    SynthesizerResult,
    VisualStyleRequest,
    VisualStyleResult,
    FrameExtractionRequest,
    LogoDetectionRequest,
    LogoDetectionResult,
    ColorHarmonyRequest,
    ColorHarmonyResult,
)
from ...agents.video_prompt import run_video_prompt
from ...agents.video_generator import run_video_generation
from ...schemas.video import (
    VideoPromptRequest,
    VideoPromptResult,
    VideoGenerationRequest,
    VideoGenerationResult,
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
    "/frame-extraction",
    response_model=FrameExtractionResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def frame_extraction_endpoint(
    payload: FrameExtractionRequest,
) -> FrameExtractionResult:
    """
    Extract frames from a video at a specified rate.
    
    This is a non-AI utility agent that extracts frames from the video
    for downstream analysis by other agents (e.g., logo detection, color analysis).
    """
    
    try:
        return run_frame_extraction(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running frame extraction agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute frame extraction agent. Check backend logs.",
        )


@router.post(
    "/logo-detection",
    response_model=LogoDetectionResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def logo_detection_endpoint(
    payload: LogoDetectionRequest,
) -> LogoDetectionResult:
    """
    Detect and extract brand logos from the provided frames.
    """

    try:
        return run_logo_detection(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running logo detection agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute logo detection agent. Check backend logs.",
        )


@router.post(
    "/video-prompt",
    response_model=VideoPromptResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def video_prompt_endpoint(payload: VideoPromptRequest) -> VideoPromptResult:
    """Generate a Veo3 prompt using Gemini."""

    try:
        return run_video_prompt(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running video prompt agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate video prompt. Check backend logs.",
        )


@router.post(
    "/video-generation",
    response_model=VideoGenerationResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def video_generation_endpoint(
    payload: VideoGenerationRequest,
) -> VideoGenerationResult:
    """Generate a Veo3 video from prompt text and reference images."""

    try:
        return run_video_generation(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running video generation agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate video. Check backend logs.",
        )


@router.post(
    "/color-harmony",
    response_model=ColorHarmonyResult,
    responses={400: {"model": AgentErrorResponse}},
)
async def color_harmony_endpoint(
    payload: ColorHarmonyRequest,
) -> ColorHarmonyResult:
    """
    Execute the color harmony agent.

    Analyzes color palettes from detected logos and video frames, comparing them
    against official brand assets to assess color alignment and harmony.
    """

    try:
        return run_color_harmony(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error while running color harmony agent")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute color harmony agent. Check backend logs.",
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
