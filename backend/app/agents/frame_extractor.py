"""
Frame extraction agent.

Extracts frames from a video file at a specified rate (e.g., 2 frames per second).
This is a non-AI utility agent that prepares video frames for downstream analysis.
"""

from __future__ import annotations

import base64
import logging
import os
import re
import tempfile
from typing import List

import cv2

from ..schemas.critique import FrameExtractionRequest, FrameExtractionResult

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
        raise ValueError("Invalid base64 payload provided for video") from exc


def _encode_frame_to_base64(frame) -> str:
    """Encode a video frame (numpy array) to base64 JPEG."""
    # Encode frame as JPEG
    success, buffer = cv2.imencode('.jpg', frame)
    if not success:
        raise ValueError("Failed to encode frame as JPEG")
    
    # Convert to base64
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{jpg_as_text}"


def run_frame_extraction(request: FrameExtractionRequest) -> FrameExtractionResult:
    """
    Extract frames from a video at the specified frames per second rate.
    
    Args:
        request: Contains the video base64 and extraction parameters
        
    Returns:
        FrameExtractionResult with extracted frames as base64-encoded images
    """
    # Decode video
    stripped = _strip_data_uri_prefix(request.video_base64)
    decoded_bytes = _decode_base64(stripped)

    # Save video to temporary file
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video_file:
        temp_video_file.write(decoded_bytes)
        temp_video_path = temp_video_file.name

    try:
        logger.info("Opening video file with OpenCV...")
        
        # Open video file
        video = cv2.VideoCapture(temp_video_path)
        
        if not video.isOpened():
            raise ValueError("Failed to open video file")
        
        # Get video properties
        fps = video.get(cv2.CAP_PROP_FPS)
        total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        logger.info(
            "Video properties - FPS: %.2f, Total frames: %d, Duration: %.2fs",
            fps,
            total_frames,
            duration,
        )
        
        # Calculate frame interval
        frames_per_second = request.frames_per_second or 2.0
        frame_interval = int(fps / frames_per_second) if fps > 0 else 1
        
        if frame_interval < 1:
            frame_interval = 1
        
        logger.info(
            "Extracting frames at %.1f fps (every %d frames)",
            frames_per_second,
            frame_interval,
        )
        
        # Extract frames
        frames = []
        frame_count = 0
        extracted_count = 0
        
        while True:
            success, frame = video.read()
            
            if not success:
                break
            
            # Extract frame at the specified interval
            if frame_count % frame_interval == 0:
                try:
                    frame_base64 = _encode_frame_to_base64(frame)
                    timestamp = frame_count / fps if fps > 0 else 0
                    
                    frames.append({
                        "frame_number": frame_count,
                        "timestamp": round(timestamp, 2),
                        "image_base64": frame_base64,
                    })
                    
                    extracted_count += 1
                    logger.debug(
                        "Extracted frame %d at timestamp %.2fs",
                        frame_count,
                        timestamp,
                    )
                except Exception as exc:
                    logger.warning("Failed to encode frame %d: %s", frame_count, exc)
            
            frame_count += 1
        
        video.release()
        
        logger.info(
            "Frame extraction complete: %d frames extracted from %d total frames",
            extracted_count,
            frame_count,
        )
        
        return FrameExtractionResult(
            frames=frames,
            total_frames_extracted=extracted_count,
            video_duration=round(duration, 2),
            video_fps=round(fps, 2),
            extraction_rate=frames_per_second,
            warnings=[],
        )
        
    except Exception as exc:
        logger.exception("Failed to extract frames from video")
        raise ValueError(f"Frame extraction failed: {str(exc)}") from exc
        
    finally:
        # Cleanup temporary file
        try:
            if os.path.exists(temp_video_path):
                os.unlink(temp_video_path)
        except Exception as exc:
            logger.warning("Failed to cleanup temp video file: %s", exc)

