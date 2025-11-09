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


class AgentErrorResponse(BaseModel):
    """Standardised error payload for agent endpoints."""

    detail: str
