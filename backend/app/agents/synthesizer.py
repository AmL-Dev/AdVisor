"""
Implementation of the synthesizer agent.

This agent aggregates the outputs of upstream analysis agents into a cohesive,
human-friendly critique that can be surfaced to users or downstream systems.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

from google.genai.types import GenerateContentResponse

from ..schemas.critique import SynthesizerRequest, SynthesizerResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


USE_DUMMY_SYNTHESIZER = os.getenv("USE_DUMMY_SYNTHESIZER", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _extract_response_text(response: GenerateContentResponse) -> str:
    """
    Attempt to extract textual payload from a Gemini response.

    The SDK can return data in multiple shapes. This helper tries the most
    common paths and concatenates multiple parts when present.
    """
    text_parts = []

    if hasattr(response, "text") and response.text:
        text_parts.append(response.text)
    elif hasattr(response, "candidates") and response.candidates:
        for candidate in response.candidates:
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        text_parts.append(part.text)

    return "".join(text_parts)


def _parse_json_response(text: str) -> Dict[str, Any]:
    """
    Extract JSON from a model response, handling markdown code blocks.
    """
    if not text:
        return {
            "combinedSummary": "",
            "keyInsights": [],
            "risks": [],
            "recommendations": [],
        }

    import re  # local import to avoid module-level dependency

    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    json_match = re.search(r"\{.*\}", text, re.DOTALL)
    if json_match:
        text = json_match.group(0)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Synthesizer received non-JSON response, returning fallback structure")
        return {
            "combinedSummary": text.strip(),
            "keyInsights": [],
            "risks": [],
            "recommendations": [],
        }


def _build_prompt(request: SynthesizerRequest) -> str:
    """Construct the prompt for the synthesizer agent."""
    brand = request.brand_context
    company = brand.company_name
    product = brand.product_name
    brief = brand.brief_prompt or ""

    overall_report_str = json.dumps(request.overall_report, indent=2)
    visual_report_str = json.dumps(request.visual_report, indent=2)

    return (
        "You are the Synthesizer agent in a multi-agent brand quality workflow. "
        "Two upstream agents have evaluated an advertisement. Aggregate their "
        "insights into a cohesive, human-readable critique that a brand lead can "
        "use directly.\n\n"
        f"Brand Context:\n- Company: {company}\n- Product: {product}\n"
        f"{'- Creative brief: ' + brief if brief else ''}\n\n"
        "Overall Critic Agent Report (JSON):\n"
        f"{overall_report_str}\n\n"
        "Visual Style Agent Report (JSON):\n"
        f"{visual_report_str}\n\n"
        "Return a JSON object with the following structure:\n"
        "{\n"
        '  "combinedSummary": string,\n'
        '  "brandAlignment": {\n'
        '    "score": number (0-1),\n'
        '    "narrative": string\n'
        "  },\n"
        '  "visualIdentity": {\n'
        '    "score": number (0-1),\n'
        '    "narrative": string\n'
        "  },\n"
        '  "keyInsights": [string],\n'
        '  "risks": [string],\n'
        '  "recommendations": [string]\n'
        "}\n"
        "Ensure the language is polished, non-repetitive, and actionable. "
        "If a numeric score is unavailable, estimate one based on the provided context."
    )


def run_synthesizer(request: SynthesizerRequest) -> SynthesizerResult:
    """Execute the synthesizer agent and return a structured result."""
    if USE_DUMMY_SYNTHESIZER:
        brand = request.brand_context
        brand_description = f"{brand.company_name}'s {brand.product_name}".strip()

        report = {
            "combinedSummary": (
                "Dummy synthesis generated – real Gemini call skipped to save credits."
            ),
            "brandAlignment": {
                "score": 0.5,
                "narrative": (
                    f"No authentic scoring performed for {brand_description} while dummy mode is active."
                ),
            },
            "visualIdentity": {
                "score": 0.5,
                "narrative": "Visual identity analysis not executed.",
            },
            "keyInsights": ["Placeholder insight only."],
            "risks": ["Real synthesis skipped."],
            "recommendations": [
                "Disable USE_DUMMY_SYNTHESIZER to run the actual Gemini synthesizer.",
            ],
        }

        return SynthesizerResult(
            report=report,
            prompt="DUMMY_MODE: Synthesizer agent skipped",
            warnings=[
                "USE_DUMMY_SYNTHESIZER is enabled – no Gemini tokens consumed for synthesis."
            ],
        )

    client = get_genai_client()

    prompt = _build_prompt(request)
    logger.info("Generating synthesized critique with Gemini...")

    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[
            {
                "role": "user",
                "parts": [
                    {
                        "text": prompt,
                    }
                ],
            }
        ],
    )

    response_text = _extract_response_text(response)
    logger.debug("Synthesizer raw response length: %d", len(response_text))

    report = _parse_json_response(response_text)

    return SynthesizerResult(
        report=report,
        prompt=prompt,
        warnings=[],
    )

