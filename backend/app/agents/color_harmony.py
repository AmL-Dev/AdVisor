"""
Color harmony agent.

Analyzes color palettes from detected logos and video frames, comparing them
against official brand assets to assess color alignment and harmony.

Uses OpenCV for color extraction and HEX color detection.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from collections import Counter
from typing import List, Optional, Tuple

import cv2
import numpy as np
from google.genai.types import GenerateContentResponse
from sklearn.cluster import KMeans

from ..schemas.critique import (
    ColorHarmonyRequest,
    ColorHarmonyResult,
    ColorPalette,
    DetectedLogo,
    ExtractedFrame,
)
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


DATA_URI_PATTERN = re.compile(r"^data:.+;base64,")


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


def _rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB values to HEX color code."""
    return f"#{r:02x}{g:02x}{b:02x}".upper()


def _extract_dominant_colors(
    image: np.ndarray,
    n_colors: int = 5,
    sample_size: int = 10000,
) -> List[str]:
    """
    Extract dominant colors from an image using K-means clustering.
    
    Args:
        image: BGR image array
        n_colors: Number of dominant colors to extract
        sample_size: Maximum number of pixels to sample for clustering
        
    Returns:
        List of HEX color codes sorted by frequency
    """
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Reshape to list of pixels
    pixels = image_rgb.reshape(-1, 3)
    
    # Sample pixels if image is too large
    if len(pixels) > sample_size:
        indices = np.random.choice(len(pixels), sample_size, replace=False)
        pixels = pixels[indices]
    
    # Remove pure black and pure white (often background/artifacts)
    mask = ~((pixels == [0, 0, 0]).all(axis=1) | (pixels == [255, 255, 255]).all(axis=1))
    pixels = pixels[mask]
    
    if len(pixels) < n_colors:
        # If not enough pixels, use all unique colors
        unique_colors = np.unique(pixels.reshape(-1, 3), axis=0)
        hex_colors = [_rgb_to_hex(int(r), int(g), int(b)) for r, g, b in unique_colors]
        return hex_colors[:n_colors]
    
    # Apply K-means clustering
    kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
    kmeans.fit(pixels)
    
    # Get cluster centers (dominant colors)
    colors = kmeans.cluster_centers_.astype(int)
    
    # Count pixels in each cluster to sort by frequency
    labels = kmeans.labels_
    label_counts = Counter(labels)
    
    # Sort colors by frequency
    sorted_colors = sorted(
        zip(colors, [label_counts[i] for i in range(len(colors))]),
        key=lambda x: x[1],
        reverse=True,
    )
    
    hex_colors = [_rgb_to_hex(int(r), int(g), int(b)) for (r, g, b), _ in sorted_colors]
    
    return hex_colors


def _calculate_color_distance(hex1: str, hex2: str) -> float:
    """
    Calculate perceptual color distance between two HEX colors using LAB color space.
    
    Returns:
        Distance value (0 = identical, higher = more different)
    """
    def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        hex_color = hex_color.lstrip("#")
        return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    
    def rgb_to_lab(rgb: Tuple[int, int, int]) -> Tuple[float, float, float]:
        """Convert RGB to LAB color space."""
        r, g, b = [x / 255.0 for x in rgb]
        
        # Convert to XYZ
        def f(t: float) -> float:
            return ((t + 0.055) / 1.055) ** 2.4 if t > 0.04045 else t / 12.92
        
        r, g, b = f(r), f(g), f(b)
        
        x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
        y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
        z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
        
        def f2(t: float) -> float:
            return t ** (1.0 / 3.0) if t > 0.008856 else (7.787 * t + 16.0 / 116.0)
        
        x, y, z = f2(x), f2(y), f2(z)
        
        L = (116.0 * y) - 16.0
        a = 500.0 * (x - y)
        b = 200.0 * (y - z)
        
        return (L, a, b)
    
    rgb1 = hex_to_rgb(hex1)
    rgb2 = hex_to_rgb(hex2)
    
    lab1 = rgb_to_lab(rgb1)
    lab2 = rgb_to_lab(rgb2)
    
    # Calculate Euclidean distance in LAB space
    distance = sum((a - b) ** 2 for a, b in zip(lab1, lab2)) ** 0.5
    
    return distance


def _calculate_color_alignment(
    palette1: List[str],
    palette2: List[str],
    threshold: float = 120.0,  # Increased from 50.0 for more lenient matching
) -> float:
    """
    Calculate how well two color palettes align.
    
    Uses a more relaxed threshold to allow for reasonable color variations
    while still penalizing completely different color schemes.
    
    Returns:
        Score between 0 and 1 (1 = perfect alignment)
    """
    if not palette1 or not palette2:
        return 0.0
    
    # Find minimum distances between colors in the two palettes
    min_distances = []
    for color1 in palette1:
        distances = [_calculate_color_distance(color1, color2) for color2 in palette2]
        min_distances.append(min(distances))
    
    # Convert distances to scores using a softer, more lenient curve
    # Using a higher threshold and a square root curve for gentler penalties
    # This gives partial credit even for moderately different colors
    scores = []
    for d in min_distances:
        if d < 20:
            # Very close colors get high score
            score = 1.0 - (d / 40.0)
        elif d < threshold:
            # Moderate differences get partial credit with softer penalty
            normalized = (d - 20) / (threshold - 20)
            score = 0.8 * (1.0 - (normalized ** 0.7))  # Square root curve for gentler falloff
        else:
            # Very different colors still get minimal credit
            excess = d - threshold
            score = max(0.1, 0.3 - (excess / (threshold * 2)))
        scores.append(score)
    
    # Return average score
    return sum(scores) / len(scores) if scores else 0.0


def _analyze_frame_colors(frames: List[ExtractedFrame]) -> ColorPalette:
    """Extract dominant colors from a set of frames."""
    all_colors: List[str] = []
    
    for frame in frames[:8]:  # Analyze first 8 frames
        try:
            image = _decode_base64_image(frame.image_base64)
            colors = _extract_dominant_colors(image, n_colors=3)
            all_colors.extend(colors)
        except Exception as exc:
            logger.warning("Failed to extract colors from frame %d: %s", frame.frame_number, exc)
    
    if not all_colors:
        return ColorPalette(
            dominant_colors=[],
            secondary_colors=[],
            color_count=0,
        )
    
    # Count color frequencies
    color_counts = Counter(all_colors)
    
    # Get top 5 most frequent colors
    top_colors = [color for color, _ in color_counts.most_common(5)]
    
    return ColorPalette(
        dominant_colors=top_colors[:3],
        secondary_colors=top_colors[3:],
        color_count=len(set(all_colors)),
    )


def _extract_response_text(response: GenerateContentResponse) -> str:
    """
    Extract the textual payload from a Gemini response.
    """
    if getattr(response, "text", None):
        return response.text  # type: ignore[return-value]

    text_fragments: List[str] = []

    if getattr(response, "candidates", None):
        for candidate in response.candidates or []:
            if getattr(candidate, "content", None):
                for part in candidate.content.parts or []:
                    if getattr(part, "text", None):
                        text_fragments.append(part.text)

    return "\n".join(fragment for fragment in text_fragments if fragment)


def _get_llm_color_feedback(
    request: ColorHarmonyRequest,
    color_alignment_score: float,
    brand_palette: ColorPalette,
    logo_palette: Optional[ColorPalette],
    frame_palette: ColorPalette,
    recommendations: List[str],
) -> Optional[str]:
    """
    Get in-depth color harmony feedback from Gemini LLM.
    
    Returns None if LLM call fails or is disabled.
    """
    # Check if LLM feedback is disabled
    use_llm_feedback = os.getenv("USE_LLM_COLOR_FEEDBACK", "true").lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    
    if not use_llm_feedback:
        logger.info("LLM color feedback is disabled")
        return None
    
    try:
        context = request.brand_context
        
        # Build prompt with color analysis data
        brand_colors_str = ', '.join(brand_palette.dominant_colors) if brand_palette.dominant_colors else 'Unable to extract'
        frame_colors_str = ', '.join(frame_palette.dominant_colors) if frame_palette.dominant_colors else 'Unable to extract'
        logo_colors_str = ', '.join(logo_palette.dominant_colors) if logo_palette and logo_palette.dominant_colors else 'No logos detected in video'
        recommendations_str = ', '.join(recommendations)
        brief_str = f'- Brief: {context.brief_prompt}\n' if context.brief_prompt else ''
        
        prompt = (
            "You are a brand color harmony expert analyzing an advertisement video.\n\n"
            f"BRAND CONTEXT:\n"
            f"- Company: {context.company_name}\n"
            f"- Product: {context.product_name}\n"
            f"{brief_str}\n"
            "COLOR ANALYSIS RESULTS:\n"
            f"- Brand Logo Colors: {brand_colors_str}\n"
            f"- Frame Colors: {frame_colors_str}\n"
            f"- Detected Logo Colors: {logo_colors_str}\n"
            f"- Color Alignment Score: {color_alignment_score:.2%}\n"
            f"- Current Recommendations: {recommendations_str}\n\n"
            "Provide detailed, actionable feedback on:\n"
            "1. How well the video colors align with the brand identity\n"
            "2. Specific color harmony issues or strengths\n"
            "3. Psychological and emotional impact of the color choices\n"
            "4. Suggestions for improving color consistency with brand guidelines\n"
            "5. Any color-related brand violations or concerns\n\n"
            "Keep the response concise (2-3 paragraphs) but insightful. Focus on actionable insights."
        )
        
        client = get_genai_client()
        
        logger.info("Generating color harmony feedback with Gemini...")
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt,
        )
        
        feedback_text = _extract_response_text(response)
        
        if not feedback_text or not feedback_text.strip():
            logger.warning("Empty response from Gemini for color feedback")
            return None
        
        logger.info("Successfully generated LLM color feedback")
        return feedback_text.strip()
        
    except Exception as exc:
        logger.warning("Failed to get LLM color feedback: %s", exc, exc_info=True)
        return None


def _analyze_logo_colors(detections: List[DetectedLogo]) -> Optional[ColorPalette]:
    """Extract colors from detected logo crops."""
    if not detections:
        return None
    
    all_colors: List[str] = []
    
    for detection in detections[:5]:  # Analyze up to 5 detections
        if not detection.crop_image_base64:
            continue
        
        try:
            image = _decode_base64_image(detection.crop_image_base64)
            colors = _extract_dominant_colors(image, n_colors=3)
            all_colors.extend(colors)
        except Exception as exc:
            logger.warning("Failed to extract colors from logo crop: %s", exc)
    
    if not all_colors:
        return None
    
    color_counts = Counter(all_colors)
    top_colors = [color for color, _ in color_counts.most_common(5)]
    
    return ColorPalette(
        dominant_colors=top_colors[:3],
        secondary_colors=top_colors[3:],
        color_count=len(set(all_colors)),
    )


def run_color_harmony(request: ColorHarmonyRequest) -> ColorHarmonyResult:
    """Execute the color harmony analysis."""
    
    warnings: List[str] = []
    
    # Extract colors from brand logo
    try:
        brand_logo_image = _decode_base64_image(request.brand_logo_base64)
        brand_logo_colors = _extract_dominant_colors(brand_logo_image, n_colors=5)
        brand_palette = ColorPalette(
            dominant_colors=brand_logo_colors[:3],
            secondary_colors=brand_logo_colors[3:],
            color_count=len(brand_logo_colors),
        )
    except Exception as exc:
        warnings.append(f"Failed to extract colors from brand logo: {exc}")
        brand_palette = ColorPalette(
            dominant_colors=[],
            secondary_colors=[],
            color_count=0,
        )
    
    # Analyze logo colors if detections exist
    logo_palette = _analyze_logo_colors(request.logo_detections)
    
    # Analyze frame colors
    frames_to_analyze = request.frames[:8]
    frame_palette = _analyze_frame_colors(frames_to_analyze)
    
    # Calculate alignment scores
    alignment_scores: List[float] = []
    
    # Compare frame colors to brand colors
    if frame_palette.dominant_colors and brand_palette.dominant_colors:
        frame_alignment = _calculate_color_alignment(
            frame_palette.dominant_colors,
            brand_palette.dominant_colors,
        )
        alignment_scores.append(frame_alignment)
    
    # Compare logo colors to brand colors if available
    if logo_palette and logo_palette.dominant_colors and brand_palette.dominant_colors:
        logo_alignment = _calculate_color_alignment(
            logo_palette.dominant_colors,
            brand_palette.dominant_colors,
        )
        alignment_scores.append(logo_alignment)
    
    # Overall alignment score
    color_alignment_score = (
        sum(alignment_scores) / len(alignment_scores) if alignment_scores else 0.0
    )
    
    # Generate analysis and recommendations
    analysis_parts: List[str] = []
    
    if logo_palette:
        analysis_parts.append(
            f"Detected logos show {len(logo_palette.dominant_colors)} primary colors: "
            f"{', '.join(logo_palette.dominant_colors)}"
        )
    else:
        analysis_parts.append("No logos detected in video frames.")
    
    analysis_parts.append(
        f"Frame color palette: {', '.join(frame_palette.dominant_colors) if frame_palette.dominant_colors else 'Unable to extract'}."
    )
    analysis_parts.append(
        f"Brand logo colors: {', '.join(brand_palette.dominant_colors) if brand_palette.dominant_colors else 'Unable to extract'}."
    )
    analysis_parts.append(
        f"Color alignment score: {color_alignment_score:.2%}."
    )
    
    analysis = " ".join(analysis_parts)
    
    # Generate recommendations
    recommendations: List[str] = []
    
    if color_alignment_score < 0.5:
        recommendations.append(
            "Consider adjusting video color palette to better match brand colors."
        )
    elif color_alignment_score < 0.7:
        recommendations.append(
            "Color alignment is moderate. Fine-tuning could improve brand consistency."
        )
    
    if logo_palette and logo_palette.dominant_colors:
        logo_brand_alignment = _calculate_color_alignment(
            logo_palette.dominant_colors,
            brand_palette.dominant_colors,
        )
        if logo_brand_alignment < 0.6:
            recommendations.append(
                "Detected logo colors differ from brand reference. Verify logo accuracy."
            )
    
    if not recommendations:
        recommendations.append("Color harmony is well-aligned with brand identity.")
    
    # Get in-depth LLM feedback
    llm_feedback = _get_llm_color_feedback(
        request=request,
        color_alignment_score=color_alignment_score,
        brand_palette=brand_palette,
        logo_palette=logo_palette,
        frame_palette=frame_palette,
        recommendations=recommendations,
    )
    
    # Enhance analysis with LLM feedback if available
    if llm_feedback:
        analysis = f"{analysis}\n\n{llm_feedback}"
    
    # Overall score (weighted combination)
    overall_score = (color_alignment_score * 0.7) + (0.3 if logo_palette else 0.0)
    
    return ColorHarmonyResult(
        overall_score=round(overall_score, 3),
        logo_colors=logo_palette,
        frame_colors=frame_palette,
        brand_logo_colors=brand_palette,
        color_alignment_score=round(color_alignment_score, 3),
        analysis=analysis,
        recommendations=recommendations,
        warnings=warnings,
    )

