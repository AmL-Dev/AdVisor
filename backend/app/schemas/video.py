"""
Schemas for video prompt generation and Veo3 video creation.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class VideoPromptRequest(BaseModel):
    """Request payload for generating a Veo3 video prompt."""

    company_name: str = Field(..., alias="companyName")
    product_name: str = Field(..., alias="productName")
    brief_prompt: str = Field(..., alias="briefPrompt")
    aspect_ratio: str = Field("16:9", alias="aspectRatio")

    class Config:
        populate_by_name = True


class VideoPromptResult(BaseModel):
    """Structured prompt returned by the prompt generation agent."""

    prompt_text: str = Field(..., alias="promptText", description="Raw JSON prompt as a string")
    warnings: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class VideoGenerationRequest(BaseModel):
    """Request payload for generating a video from a prompt."""

    prompt_text: str = Field(..., alias="promptText")
    brand_logo: str = Field(..., alias="brandLogo")
    product_image: str = Field(..., alias="productImage")
    aspect_ratio: Optional[str] = Field(None, alias="aspectRatio")

    class Config:
        populate_by_name = True

    @field_validator("prompt_text")
    @classmethod
    def validate_prompt_text(cls, value: str) -> str:
        if not value or len(value) < 10:
            raise ValueError("promptText must contain the full prompt text")
        return value

    @field_validator("brand_logo", "product_image")
    @classmethod
    def validate_image(cls, value: str, info: ValidationInfo) -> str:
        field_name = info.field_name
        if not value or len(value) < 100:
            raise ValueError(f"{field_name} must be a valid base64 image string")
        return value


class VideoGenerationResult(BaseModel):
    """Result of video generation."""

    video: str
    prompt_text: str = Field(..., alias="promptText")
    model: str = Field("veo-3.1-generate-preview")
    warnings: list[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True

