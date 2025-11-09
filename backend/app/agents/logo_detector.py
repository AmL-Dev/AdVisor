"""
Logo detection agent.

Attempts to locate the brand logo within extracted video frames using:
1. OpenCV template matching across multiple scales.
2. CLIP similarity scoring when the transformers stack is available.

The agent returns the most confident detections alongside cropped logo images
that downstream colour analysis agents can re-use.
"""

from __future__ import annotations

import base64
import logging
import math
import os
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

from ..schemas.critique import (
    DetectedLogo,
    LogoBoundingBox,
    LogoDetectionRequest,
    LogoDetectionResult,
)

logger = logging.getLogger(__name__)


DATA_URI_PATTERN = re.compile(r"^data:.+;base64,")


@dataclass
class _TemplateMatchResult:
    confidence: float
    top_left: Tuple[int, int]
    bottom_right: Tuple[int, int]
    method: str


def _strip_data_uri_prefix(data: str) -> str:
    """Remove data URI prefixes so the payload can be decoded."""

    return DATA_URI_PATTERN.sub("", data or "")


def _decode_base64_image(data: str) -> np.ndarray:
    """Decode a base64 image (optionally with data URI prefix) into a BGR numpy array."""

    stripped = _strip_data_uri_prefix(data)
    if not stripped:
        raise ValueError("Empty base64 image payload")

    try:
        image_bytes = base64.b64decode(stripped)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid base64 image payload") from exc

    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to decode image from base64 payload")

    return image


def _encode_image_to_base64(image: np.ndarray) -> str:
    """Encode an image (BGR) into base64 JPEG data URI."""

    success, buffer = cv2.imencode(".jpg", image)
    if not success:
        raise ValueError("Failed to encode image to JPEG")

    jpg_as_text = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{jpg_as_text}"


def _run_template_matching(
    frame: np.ndarray,
    logo: np.ndarray,
    scale_factors: Optional[List[float]] = None,
) -> Optional[_TemplateMatchResult]:
    """Attempt to locate the logo within the frame using template matching."""

    if scale_factors is None:
        scale_factors = [1.0, 0.9, 0.8, 0.7, 0.6, 1.1, 1.2]

    frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    logo_gray_original = cv2.cvtColor(logo, cv2.COLOR_BGR2GRAY)

    best_match: Optional[_TemplateMatchResult] = None

    for scale in scale_factors:
        resized_logo = logo_gray_original
        if not math.isclose(scale, 1.0):
            resized_logo = cv2.resize(
                logo_gray_original,
                (0, 0),
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC,
            )

        th, tw = resized_logo.shape[:2]
        fh, fw = frame_gray.shape[:2]

        if th >= fh or tw >= fw:
            continue

        result = cv2.matchTemplate(frame_gray, resized_logo, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)

        if best_match is None or max_val > best_match.confidence:
            top_left = max_loc
            bottom_right = (top_left[0] + tw, top_left[1] + th)
            best_match = _TemplateMatchResult(
                confidence=float(max_val),
                top_left=top_left,
                bottom_right=bottom_right,
                method="template",
            )

    if best_match and best_match.confidence >= 0.55:
        return best_match

    return None


def _create_detection_from_match(
    match: _TemplateMatchResult,
    frame: np.ndarray,
    frame_number: int,
    timestamp: float,
) -> DetectedLogo:
    """Convert a template match into a DetectedLogo with a cropped image."""

    fh, fw = frame.shape[:2]
    x1, y1 = match.top_left
    x2, y2 = match.bottom_right
    x2 = min(x2, fw - 1)
    y2 = min(y2, fh - 1)

    width = max(x2 - x1, 1)
    height = max(y2 - y1, 1)

    crop = frame[y1:y1 + height, x1:x1 + width]
    crop_base64 = _encode_image_to_base64(crop)

    bbox = LogoBoundingBox(
        x=x1 / fw,
        y=y1 / fh,
        width=width / fw,
        height=height / fh,
    )

    return DetectedLogo(
        frameNumber=frame_number,
        timestamp=round(float(timestamp), 2),
        method=match.method,
        confidence=round(float(match.confidence), 3),
        boundingBox=bbox,
        cropImageBase64=crop_base64,
        notes="Detected via multi-scale template matching",
    )


def _try_clip_similarity(
    frames: List[np.ndarray],
    logo: np.ndarray,
) -> Tuple[List[Tuple[int, float]], Optional[str]]:
    """
    Attempt to score frames using CLIP image embeddings.

    Returns:
        A list of (frame_index, similarity) sorted descending, and an optional warning.
    """

    prefer_clip = os.getenv("ENABLE_CLIP_LOGO", "true").lower() in {"1", "true", "yes", "on"}

    if not prefer_clip:
        return [], "CLIP scoring disabled via ENABLE_CLIP_LOGO flag."

    try:
        import torch  # type: ignore
        from PIL import Image  # type: ignore
        from transformers import CLIPModel, CLIPProcessor  # type: ignore
    except ImportError:
        return [], (
            "CLIP dependencies (torch, transformers, Pillow) are not installed; "
            "skipping similarity scoring."
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"

    try:
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load CLIP model: %s", exc)
        return [], f"Failed to load CLIP model: {exc}"

    logo_rgb = cv2.cvtColor(logo, cv2.COLOR_BGR2RGB)
    logo_image = Image.fromarray(logo_rgb)

    with torch.no_grad():
        logo_inputs = processor(images=logo_image, return_tensors="pt").to(device)
        logo_features = model.get_image_features(**logo_inputs)
        logo_features /= logo_features.norm(dim=-1, keepdim=True)

    scores: List[Tuple[int, float]] = []

    for idx, frame in enumerate(frames):
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_image = Image.fromarray(frame_rgb)

        with torch.no_grad():
            frame_inputs = processor(images=frame_image, return_tensors="pt").to(device)
            frame_features = model.get_image_features(**frame_inputs)
            frame_features /= frame_features.norm(dim=-1, keepdim=True)

        similarity = (logo_features @ frame_features.T).cpu().item()
        scores.append((idx, float(similarity)))

    scores.sort(key=lambda item: item[1], reverse=True)

    return scores, None


def run_logo_detection(request: LogoDetectionRequest) -> LogoDetectionResult:
    """Execute the logo detection pipeline."""

    warnings: List[str] = []

    try:
        logo_image = _decode_base64_image(request.brand_logo_base64)
    except ValueError as exc:
        raise ValueError(f"Invalid brand logo: {exc}") from exc

    frames_with_images: List[Tuple[int, float, np.ndarray, str]] = []

    for frame in request.frames:
        try:
            frame_image = _decode_base64_image(frame.image_base64)
            frames_with_images.append(
                (frame.frame_number, frame.timestamp, frame_image, frame.image_base64)
            )
        except ValueError as exc:
            warnings.append(f"Failed to decode frame {frame.frame_number}: {exc}")

    if not frames_with_images:
        raise ValueError("No valid frames provided for logo detection")

    template_detections: List[DetectedLogo] = []

    for frame_number, timestamp, frame_image, _ in frames_with_images:
        match = _run_template_matching(frame_image, logo_image)
        if match:
            detection = _create_detection_from_match(
                match=match,
                frame=frame_image,
                frame_number=frame_number,
                timestamp=timestamp,
            )
            template_detections.append(detection)

    template_detections.sort(key=lambda det: det.confidence, reverse=True)

    if template_detections:
        return LogoDetectionResult(
            logoFound=True,
            detections=template_detections,
            primaryDetection=template_detections[0],
            methodUsed="template",
            warnings=warnings,
            notes="Logo detected via OpenCV template matching.",
        )

    # Attempt CLIP similarity scoring if requested
    clip_scores: List[Tuple[int, float]] = []
    clip_warning: Optional[str] = None

    if request.prefer_clip:
        clip_scores, clip_warning = _try_clip_similarity(
            frames=[frame for _, _, frame, _ in frames_with_images],
            logo=logo_image,
        )
        if clip_warning:
            warnings.append(clip_warning)

    clip_detections: List[DetectedLogo] = []

    if clip_scores:
        top_scores = [item for item in clip_scores if item[1] >= 0.25][:3]
        for frame_idx, similarity in top_scores:
            frame_number, timestamp, frame_image, frame_base64 = frames_with_images[frame_idx]
            clip_detections.append(
                DetectedLogo(
                    frameNumber=frame_number,
                    timestamp=round(float(timestamp), 2),
                    method="clip",
                    confidence=round(float(similarity), 3),
                    boundingBox=None,
                    cropImageBase64=frame_base64,
                    notes="High similarity to reference logo via CLIP embeddings.",
                )
            )

    if clip_detections:
        return LogoDetectionResult(
            logoFound=True,
            detections=clip_detections,
            primaryDetection=clip_detections[0],
            methodUsed="clip",
            warnings=warnings,
            notes="Logo inferred via CLIP similarity (no precise bounding box).",
        )

    # No logo found using template matching or CLIP
    return LogoDetectionResult(
        logoFound=False,
        detections=[],
        primaryDetection=None,
        methodUsed="none",
        warnings=warnings,
        notes="No logo located using template matching or CLIP. Consider reviewing extracted frames manually.",
    )

