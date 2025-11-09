"""
Agent responsible for generating Veo3 videos using prompt text and reference images.
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Tuple

from fastapi import HTTPException
from google.genai import types as genai_types
from google.genai.errors import ClientError

from ..schemas.video import VideoGenerationRequest, VideoGenerationResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


def _strip_data_uri_prefix(data: str) -> Tuple[str, str]:
    """Split a base64 data URI into mime type and clean base64 string."""
    if data.startswith("data:"):
        header, _, encoded = data.partition(",")
        mime_type = header.split(";")[0].replace("data:", "") or "image/png"
        return mime_type, encoded.strip()

    # Default to PNG if mime not provided
    return "image/png", data.strip()


def _decode_base64(data: str) -> bytes:
    """Decode base64 data."""
    try:
        return base64.b64decode(data, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid base64 payload") from exc


def _poll_and_download_video(
    client, operation, prompt_text: str, max_attempts: int = 60
) -> VideoGenerationResult:
    """Poll for video generation completion and download the result."""
    poll_attempts = 0

    while not getattr(operation, "done", False) and poll_attempts < max_attempts:
        time.sleep(10)
        operation = client.operations.get(operation.name)
        poll_attempts += 1
        logger.debug("Video generation polling attempt %d", poll_attempts)

    if not getattr(operation, "done", False):
        raise TimeoutError("Video generation timed out. Please try again.")

    result = getattr(operation, "result", None)
    if not result or not getattr(result, "generated_videos", None):
        raise ValueError("Video generation finished without a video result.")

    generated_video = result.generated_videos[0]
    video_file = getattr(generated_video, "video", None)

    if not video_file:
        raise ValueError("Video generation completed but no video file was returned.")

    logger.info("Downloading generated video file %s", getattr(video_file, "name", "unknown"))

    # Download the file into memory
    download_response = client.files.download(name=video_file.name)

    if download_response is None:
        raise ValueError("Failed to download generated video data.")

    if hasattr(download_response, "read"):
        video_bytes = download_response.read()
    elif hasattr(download_response, "data"):
        video_bytes = download_response.data
    elif isinstance(download_response, bytes):
        video_bytes = download_response
    else:
        raise ValueError("Unexpected response type from files.download()")

    if not video_bytes:
        raise ValueError("Downloaded video data is empty.")

    video_base64 = base64.b64encode(video_bytes).decode("utf-8")

    return VideoGenerationResult(
        video=f"data:video/mp4;base64,{video_base64}",
        prompt_text=prompt_text,
        warnings=[],
    )


def run_video_generation(request: VideoGenerationRequest) -> VideoGenerationResult:
    """Generate a video using Veo3 with the supplied prompt and reference images."""
    client = get_genai_client()
    aspect_ratio = request.aspect_ratio or "16:9"

    logger.info("Starting Veo3 video generation (aspect ratio: %s)", aspect_ratio)

    # Prepare reference images from base64 data URIs
    logo_mime, logo_base64 = _strip_data_uri_prefix(request.brand_logo)
    product_mime, product_base64 = _strip_data_uri_prefix(request.product_image)

    try:
        # Decode base64 to bytes for the Python SDK
        logo_bytes = _decode_base64(logo_base64)
        product_bytes = _decode_base64(product_base64)
        
        logger.info("Creating video generation request with:")
        logger.info("  - Logo size: %d bytes (mime: %s)", len(logo_bytes), logo_mime)
        logger.info("  - Product size: %d bytes (mime: %s)", len(product_bytes), product_mime)
        logger.info("  - Aspect ratio: %s", aspect_ratio)
        logger.info("  - Prompt length: %d chars", len(request.prompt_text))
        
        # Create proper types.Image objects using image_bytes (Python SDK style)
        logo_image = genai_types.Image(
            image_bytes=logo_bytes,
            mime_type=logo_mime,
        )
        
        product_image = genai_types.Image(
            image_bytes=product_bytes,
            mime_type=product_mime,
        )
        
        # Create reference images with the proper Image objects
        reference_images = [
            genai_types.VideoGenerationReferenceImage(
                image=logo_image,
                reference_type="asset",
            ),
            genai_types.VideoGenerationReferenceImage(
                image=product_image,
                reference_type="asset",
            ),
        ]
        
        logger.info("Starting video generation with %d reference images...", len(reference_images))
        
        try:
            operation = client.models.generate_videos(
                model="veo-3.1-generate-preview",
                prompt=request.prompt_text,
                config=genai_types.GenerateVideosConfig(
                    reference_images=reference_images,
                    aspect_ratio=aspect_ratio,
                ),
            )
            logger.info("Video generation operation started: %s", operation.name if hasattr(operation, "name") else operation)
            
            return _poll_and_download_video(client, operation, request.prompt_text)
            
        except ClientError as e:
            # Check if it's a RESOURCE_EXHAUSTED error (429)
            # ClientError can have status_code as attribute or in error dict
            is_resource_exhausted = False
            
            if hasattr(e, "status_code") and e.status_code == 429:
                is_resource_exhausted = True
            elif hasattr(e, "error") and isinstance(e.error, dict):
                error_code = e.error.get("code")
                error_status = e.error.get("status", "")
                if error_code == 429 or "RESOURCE_EXHAUSTED" in error_status.upper():
                    is_resource_exhausted = True
            elif "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e).upper():
                is_resource_exhausted = True
            
            if is_resource_exhausted:
                logger.warning(
                    "Resource exhausted (429) with reference images. "
                    "Falling back to veo-3.0-generate-preview without reference images."
                )
                
                # Fallback: generate without reference images using older model
                operation = client.models.generate_videos(
                    model="veo-3.0-fast-generate-preview",
                    prompt=request.prompt_text,
                    config=genai_types.GenerateVideosConfig(
                        aspect_ratio=aspect_ratio,
                    ),
                )
                logger.info(
                    "Fallback video generation operation started (no reference images): %s",
                    operation.name if hasattr(operation, "name") else operation
                )
                
                result = _poll_and_download_video(client, operation, request.prompt_text)
                # Add a warning to indicate fallback was used
                result.warnings = [
                    "Video generated using fallback method (veo-3.0 without reference images) "
                    "due to resource quota limits."
                ]
                return result
            else:
                # Re-raise if it's a different ClientError
                raise
    
    except Exception as e:
        logger.error("Video generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

