"""
Implementation of the visual style agent.

The agent analyzes the visual style of the video ad using Gemini with video input
and brand reference images (logo, product image) to assess visual consistency,
aesthetic quality, and brand alignment.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
import time
from typing import Any, Dict

from google.genai.types import GenerateContentResponse

from ..schemas.critique import VisualStyleRequest, VisualStyleResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


DATA_URI_PATTERN = re.compile(r"^data:.+;base64,")


def _strip_data_uri_prefix(data: str) -> str:
    """Remove data URI prefixes so the payload can be decoded."""
    return DATA_URI_PATTERN.sub("", data)


def _decode_base64(data: str) -> bytes:
    """Decode base64 data and raise a helpful error if it fails."""
    try:
        return base64.b64decode(data, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid base64 payload provided") from exc


def _extract_response_text(response: GenerateContentResponse) -> str:
    """
    Attempt to extract the textual payload from a Gemini response.
    """
    text_parts = []
    if hasattr(response, "text"):
        text_parts.append(response.text)
    elif hasattr(response, "candidates") and response.candidates:
        for candidate in response.candidates:
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "text"):
                        text_parts.append(part.text)
    return "".join(text_parts)


def _parse_json_response(text: str) -> Dict[str, Any]:
    """
    Extract JSON from the response text, handling markdown code blocks.
    """
    # Try to find JSON in markdown code blocks
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    # Try to find JSON object directly
    json_match = re.search(r"\{.*\}", text, re.DOTALL)
    if json_match:
        text = json_match.group(0)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse JSON from response: %s", exc)
        logger.debug("Response text: %s", text)
        # Return a fallback structure
        return {
            "error": "Failed to parse JSON response",
            "raw_text": text[:500],  # First 500 chars
        }


def _wait_for_file_active(client, file_obj, max_wait_seconds: int = 120) -> None:
    """
    Wait for an uploaded file to become ACTIVE before using it.
    """
    start_time = time.time()
    poll_interval = 2
    file_identifier = file_obj
    if hasattr(file_obj, "uri"):
        file_identifier = file_obj.uri
    elif hasattr(file_obj, "name"):
        file_identifier = file_obj.name

    file_uri_str = str(file_identifier)
    logger.info("Waiting for file %s to become ACTIVE...", file_uri_str)

    while time.time() - start_time < max_wait_seconds:
        try:
            file_info = client.files.get(name=file_identifier)
            state = None
            if hasattr(file_info, "state"):
                state = file_info.state
            elif hasattr(file_info, "status"):
                state = file_info.status

            if state is None and hasattr(file_info, "model_dump"):
                file_dict = file_info.model_dump()
                state = file_dict.get("state") or file_dict.get("status")

            state_str = str(state) if state else None
            if state_str and ("ACTIVE" in state_str.upper() or state == "ACTIVE"):
                logger.info("File %s is now ACTIVE", file_uri_str)
                return

            elapsed = int(time.time() - start_time)
            logger.debug(
                "File %s state: %s (elapsed: %ds), waiting...",
                file_uri_str,
                state_str or "unknown",
                elapsed,
            )
            time.sleep(poll_interval)

        except Exception as exc:
            elapsed = int(time.time() - start_time)
            logger.warning(
                "Error checking file status (elapsed: %ds): %s, continuing...",
                elapsed,
                exc,
            )
            time.sleep(poll_interval)

    raise TimeoutError(
        f"File {file_uri_str} did not become ACTIVE within {max_wait_seconds} seconds"
    )


def _build_prompt(request: VisualStyleRequest) -> str:
    """Build the prompt for visual style analysis."""
    company = request.brand_context.company_name
    product = request.brand_context.product_name

    return (
        f"You are a visual style expert evaluating an advertisement video for {company}'s {product}. "
        f"Analyze the visual style, aesthetic quality, and brand consistency of the video.\n\n"
        f"Brand Context:\n"
        f"- Company: {company}\n"
        f"- Product: {product}\n"
        f"{f'- Brief: {request.brand_context.brief_prompt}' if request.brand_context.brief_prompt else ''}\n\n"
        f"Reference Images Provided:\n"
        f"- Brand Logo: {'Yes' if request.brand_logo_base64 else 'No'}\n"
        f"- Product Image: {'Yes' if request.product_image_base64 else 'No'}\n\n"
        f"Evaluate the video across these dimensions:\n"
        f"1. Visual Style Consistency (0-1): Does the video maintain a consistent visual style throughout?\n"
        f"2. Aesthetic Quality (0-1): Overall visual appeal, composition, lighting, color grading\n"
        f"3. Brand Visual Alignment (0-1): How well does the visual style match the brand identity?\n"
        f"4. Color Palette Harmony (0-1): Are colors cohesive and aligned with brand colors?\n"
        f"5. Typography & Text Treatment (0-1): Quality and consistency of text elements\n"
        f"6. Visual Hierarchy (0-1): Clear focus and flow of visual elements\n"
        f"7. Production Quality (0-1): Technical quality (resolution, stability, artifacts)\n\n"
        f"Output a JSON object with:\n"
        f"- scores: Object with each dimension score (0-1)\n"
        f"- overallScore: Average of all dimension scores (0-1)\n"
        f"- strengths: Array of specific visual strengths\n"
        f"- weaknesses: Array of visual weaknesses or inconsistencies\n"
        f"- recommendations: Array of specific recommendations for improvement\n"
        f"- styleNotes: Detailed notes on visual style elements observed\n\n"
        f"Return JSON only, no markdown formatting."
    )


def run_visual_style(request: VisualStyleRequest) -> VisualStyleResult:
    """Execute the visual style agent and return a structured result."""

    # Decode video
    stripped = _strip_data_uri_prefix(request.video_base64)
    decoded_bytes = _decode_base64(stripped)

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video_file:
        temp_video_file.write(decoded_bytes)
        temp_video_path = temp_video_file.name

    client = get_genai_client()
    temp_logo_path = None
    temp_product_path = None

    try:
        # Upload video
        logger.info("Uploading video file to Google GenAI...")
        uploaded_video = client.files.upload(file=temp_video_path)
        logger.info("Video uploaded, URI: %s", uploaded_video.uri if hasattr(uploaded_video, "uri") else "N/A")

        logger.info("Waiting for file to become ACTIVE...")
        _wait_for_file_active(client, uploaded_video)

        # Prepare reference images if provided
        parts = [
            {"text": _build_prompt(request)},
            {
                "file_data": {
                    "file_uri": uploaded_video.uri,
                    "mime_type": uploaded_video.mime_type,
                }
            },
        ]

        # Add brand logo if provided
        if request.brand_logo_base64:
            try:
                logo_stripped = _strip_data_uri_prefix(request.brand_logo_base64)
                logo_bytes = _decode_base64(logo_stripped)
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_logo_file:
                    temp_logo_file.write(logo_bytes)
                    temp_logo_path = temp_logo_file.name

                uploaded_logo = client.files.upload(file=temp_logo_path)
                _wait_for_file_active(client, uploaded_logo)
                parts.append({
                    "file_data": {
                        "file_uri": uploaded_logo.uri,
                        "mime_type": uploaded_logo.mime_type,
                    }
                })
                logger.info("Brand logo uploaded and ready")
            except Exception as exc:
                logger.warning("Failed to process brand logo: %s", exc)

        # Add product image if provided
        if request.product_image_base64:
            try:
                product_stripped = _strip_data_uri_prefix(request.product_image_base64)
                product_bytes = _decode_base64(product_stripped)
                with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_product_file:
                    temp_product_file.write(product_bytes)
                    temp_product_path = temp_product_file.name

                uploaded_product = client.files.upload(file=temp_product_path)
                _wait_for_file_active(client, uploaded_product)
                parts.append({
                    "file_data": {
                        "file_uri": uploaded_product.uri,
                        "mime_type": uploaded_product.mime_type,
                    }
                })
                logger.info("Product image uploaded and ready")
            except Exception as exc:
                logger.warning("Failed to process product image: %s", exc)

        # Generate content
        logger.info("Generating content with Gemini...")
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=[
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
        )

        response_text = _extract_response_text(response)
        logger.debug("Raw response text length: %d", len(response_text))

        report = _parse_json_response(response_text)

        return VisualStyleResult(
            report=report,
            prompt=_build_prompt(request),
            warnings=[],
        )

    finally:
        # Cleanup temporary files
        for temp_path in [temp_video_path, temp_logo_path, temp_product_path]:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as exc:
                    logger.warning("Failed to cleanup temp file %s: %s", temp_path, exc)

