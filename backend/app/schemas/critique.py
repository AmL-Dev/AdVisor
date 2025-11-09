"""
Pydantic data models for the critique endpoints.

Having well-defined schemas ensures FastAPI performs automatic validation on
incoming requests and helps TypeScript consumers via generated OpenAPI schemas.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, validator, ValidationInfo


class BrandContext(BaseModel):
    """Metadata that gives the critic agent additional context."""

    company_name: str = Field(..., alias="companyName")
    product_name: str = Field(..., alias="productName")
    brief_prompt: Optional[str] = Field(None, alias="briefPrompt")

    class Config:
        populate_by_name = True


class OverallCriticRequest(BaseModel):
    """
    Request payload expected by the overall critic agent.

    Attributes:
        video_base64: Base64-encoded content of the generated advertisement
            video. Data-URI prefixes are accepted and will be stripped
            automatically prior to processing.
        brand_context: Additional brand information to help the agent evaluate
            alignment.
    """

    video_base64: str = Field(..., alias="videoBase64")
    brand_context: BrandContext = Field(..., alias="brandContext")

    class Config:
        populate_by_name = True

    @validator("video_base64")
    def validate_video(cls, value: str) -> str:
        if not value:
            raise ValueError("video_base64 must not be empty")
        if len(value) < 100:
            raise ValueError("video_base64 payload appears to be too small")
        return value


class OverallCriticResult(BaseModel):
    """Structured result returned by the overall critic agent."""

    report: Dict[str, Any]
    prompt: str
    model: str = "gemini-2.0-flash-exp"
    warnings: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = Field(None, alias="rawText")

    class Config:
        populate_by_name = True


class VisualStyleRequest(BaseModel):
    """
    Request payload expected by the visual style agent.

    Attributes:
        video_base64: Base64-encoded content of the generated advertisement video.
        brand_logo_base64: Base64-encoded brand logo image for reference.
        product_image_base64: Base64-encoded product image for reference.
        brand_context: Additional brand information to help the agent evaluate
            visual style alignment.
    """

    video_base64: str = Field(..., alias="videoBase64")
    brand_logo_base64: str = Field(..., alias="brandLogoBase64")
    product_image_base64: Optional[str] = Field(None, alias="productImageBase64")
    brand_context: BrandContext = Field(..., alias="brandContext")

    class Config:
        populate_by_name = True

    @validator("video_base64")
    def validate_video(cls, value: str) -> str:
        if not value:
            raise ValueError("video_base64 must not be empty")
        if len(value) < 100:
            raise ValueError("video_base64 payload appears to be too small")
        return value


class VisualStyleResult(BaseModel):
    """Structured result returned by the visual style agent."""

    report: Dict[str, Any]
    prompt: str
    warnings: List[str] = Field(default_factory=list)


class SynthesizerRequest(BaseModel):
    """
    Request payload for the synthesizer agent.

    Attributes:
        overall_report: Output report from the overall critic agent.
        visual_report: Output report from the visual style agent.
        brand_context: Brand information to provide context while synthesizing.
    """

    overall_report: Dict[str, Any] = Field(..., alias="overallReport")
    visual_report: Dict[str, Any] = Field(..., alias="visualReport")
    brand_context: BrandContext = Field(..., alias="brandContext")

    class Config:
        populate_by_name = True


class SynthesizerResult(BaseModel):
    """Structured result returned by the synthesizer agent."""

    report: Dict[str, Any]
    prompt: str
    warnings: List[str] = Field(default_factory=list)


class FrameExtractionRequest(BaseModel):
    """
    Request payload for frame extraction agent.
    
    Attributes:
        video_base64: Base64-encoded video file
        frames_per_second: Number of frames to extract per second (default: 2.0)
    """
    
    video_base64: str = Field(..., alias="videoBase64")
    frames_per_second: Optional[float] = Field(2.0, alias="framesPerSecond")
    
    class Config:
        populate_by_name = True
    
    @validator("video_base64")
    def validate_video(cls, value: str) -> str:
        if not value:
            raise ValueError("video_base64 must not be empty")
        if len(value) < 100:
            raise ValueError("video_base64 payload appears to be too small")
        return value


class ExtractedFrame(BaseModel):
    """Single extracted frame from video."""
    
    frame_number: int = Field(..., alias="frameNumber")
    timestamp: float
    image_base64: str = Field(..., alias="imageBase64")
    
    class Config:
        populate_by_name = True


class FrameExtractionResult(BaseModel):
    """Result of frame extraction."""
    
    frames: List[ExtractedFrame]
    total_frames_extracted: int = Field(..., alias="totalFramesExtracted")
    video_duration: float = Field(..., alias="videoDuration")
    video_fps: float = Field(..., alias="videoFps")
    extraction_rate: float = Field(..., alias="extractionRate")
    warnings: List[str] = Field(default_factory=list)
    
    class Config:
        populate_by_name = True


class LogoBoundingBox(BaseModel):
    """Normalized bounding box for a detected logo."""

    x: float
    y: float
    width: float
    height: float

    @field_validator("x", "y", "width", "height")
    @classmethod
    def validate_bounds(cls, value: float, info: ValidationInfo) -> float:
        if value < 0 or value > 1:
            raise ValueError(f"{info.field_name} must be between 0 and 1")
        return value


class DetectedLogo(BaseModel):
    """Represents a detected logo instance."""

    frame_number: int = Field(..., alias="frameNumber")
    timestamp: float
    method: str
    confidence: float
    bounding_box: Optional[LogoBoundingBox] = Field(None, alias="boundingBox")
    crop_image_base64: Optional[str] = Field(None, alias="cropImageBase64")
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class LogoDetectionRequest(BaseModel):
    """
    Request payload for the logo detection agent.

    Attributes:
        frames: Extracted frames from the video (output of frame_extraction).
        brand_logo_base64: Reference brand logo image (base64).
        brand_context: Brand metadata for logging/prompts.
    """

    frames: List[ExtractedFrame]
    brand_logo_base64: str = Field(..., alias="brandLogoBase64")
    brand_context: BrandContext = Field(..., alias="brandContext")
    prefer_clip: bool = Field(True, alias="preferClip")
    use_gemini_fallback: bool = Field(True, alias="useGeminiFallback")

    class Config:
        populate_by_name = True

    @validator("brand_logo_base64")
    def validate_logo(cls, value: str) -> str:
        if not value:
            raise ValueError("brand_logo_base64 must not be empty")
        if len(value) < 100:
            raise ValueError("brand_logo_base64 payload appears to be too small")
        return value


class LogoDetectionResult(BaseModel):
    """Result payload for detected logos."""

    logo_found: bool = Field(..., alias="logoFound")
    detections: List[DetectedLogo] = Field(default_factory=list)
    primary_detection: Optional[DetectedLogo] = Field(None, alias="primaryDetection")
    method_used: Optional[str] = Field(None, alias="methodUsed")
    warnings: List[str] = Field(default_factory=list)
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class ColorPalette(BaseModel):
    """Extracted color palette from an image."""
    
    dominant_colors: List[str] = Field(..., alias="dominantColors")  # HEX codes
    secondary_colors: List[str] = Field(default_factory=list, alias="secondaryColors")
    color_count: int = Field(..., alias="colorCount")
    
    class Config:
        populate_by_name = True


class ColorHarmonyRequest(BaseModel):
    """
    Request payload for the color harmony agent.
    
    Attributes:
        frames: Extracted frames from the video
        logo_detections: Detected logos (if any)
        brand_logo_base64: Reference brand logo for color comparison
        product_image_base64: Optional product image for color reference
        brand_context: Brand metadata
    """
    
    frames: List[ExtractedFrame]
    logo_detections: List[DetectedLogo] = Field(default_factory=list, alias="logoDetections")
    brand_logo_base64: str = Field(..., alias="brandLogoBase64")
    product_image_base64: Optional[str] = Field(None, alias="productImageBase64")
    brand_context: BrandContext = Field(..., alias="brandContext")
    
    class Config:
        populate_by_name = True


class ColorHarmonyResult(BaseModel):
    """Result of color harmony analysis."""
    
    overall_score: float = Field(..., alias="overallScore")  # 0-1
    logo_colors: Optional[ColorPalette] = Field(None, alias="logoColors")
    frame_colors: ColorPalette = Field(..., alias="frameColors")
    brand_logo_colors: ColorPalette = Field(..., alias="brandLogoColors")
    color_alignment_score: float = Field(..., alias="colorAlignmentScore")  # 0-1
    analysis: str
    recommendations: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    
    class Config:
        populate_by_name = True


class AgentErrorResponse(BaseModel):
    """Standardised error payload for agent endpoints."""

    detail: str
