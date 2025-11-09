"""
Pydantic data models for the critique endpoints.

Having well-defined schemas ensures FastAPI performs automatic validation on
incoming requests and helps TypeScript consumers via generated OpenAPI schemas.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


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
    product_image_base64: str = Field(..., alias="productImageBase64")
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


class AgentErrorResponse(BaseModel):
    """Standardised error payload for agent endpoints."""

    detail: str
