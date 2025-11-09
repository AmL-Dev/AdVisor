"""
Advisor agent that aggregates all analysis results.

This agent combines insights from:
- Brand alignment workflow (synthesizer)
- Safety and ethics agent
- Message clarity agent

It generates a comprehensive report with:
- Brand alignment (0-1)
- Visual quality (0-1)
- Tone accuracy (0-1)
- Any violations or off-brand elements
- A validation prompt to append to the original prompt
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

from google.genai.types import GenerateContentResponse

from ..schemas.critique import AdvisorRequest, AdvisorResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


USE_DUMMY_ADVISOR = os.getenv("USE_DUMMY_ADVISOR", "false").lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _extract_response_text(response: GenerateContentResponse) -> str:
    """
    Attempt to extract textual payload from a Gemini response.
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
            "brandAlignment": 0.5,
            "visualQuality": 0.5,
            "toneAccuracy": 0.5,
            "violations": [],
            "offBrandElements": [],
            "comprehensiveReport": "",
            "justifications": {},
            "validationPrompt": "",
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
        logger.warning("Advisor received non-JSON response, returning fallback structure")
        return {
            "brandAlignment": 0.5,
            "visualQuality": 0.5,
            "toneAccuracy": 0.5,
            "violations": [],
            "offBrandElements": [],
            "comprehensiveReport": text.strip(),
            "justifications": {},
            "validationPrompt": "",
        }


def _build_prompt(request: AdvisorRequest) -> str:
    """Construct the prompt for the advisor agent."""
    brand = request.brand_context
    company = brand.company_name
    product = brand.product_name
    brief = brand.brief_prompt or ""

    synthesizer_report_str = json.dumps(request.synthesizer_report, indent=2)
    safety_ethics_report_str = json.dumps(request.safety_ethics_report, indent=2)
    message_clarity_report_str = json.dumps(request.message_clarity_report, indent=2)
    brand_alignment_report_str = json.dumps(request.brand_alignment_report, indent=2)
    original_prompt_section = (
        f"\n\nORIGINAL PROMPT USED TO GENERATE THE VIDEO:\n{request.original_prompt}\n"
        if request.original_prompt
        else ""
    )

    return (
        "You are the AdVisor agent, the final aggregator in a multi-agent brand quality workflow. "
        "You receive comprehensive analysis from multiple specialized agents and must synthesize "
        "their findings into a final, actionable report.\n\n"
        f"Brand Context:\n- Company: {company}\n- Product: {product}\n"
        f"{'- Creative brief: ' + brief if brief else ''}\n\n"
        "You have received analysis from the following agents:\n\n"
        "1. BRAND ALIGNMENT WORKFLOW REPORT:\n"
        f"{brand_alignment_report_str}\n\n"
        "2. SYNTHESIZER REPORT (aggregated brand alignment insights):\n"
        f"{synthesizer_report_str}\n\n"
        "3. SAFETY AND ETHICS REPORT:\n"
        f"{safety_ethics_report_str}\n\n"
        "4. MESSAGE CLARITY REPORT:\n"
        f"{message_clarity_report_str}\n{original_prompt_section}"
        "Based on all these reports, generate a comprehensive final report with the following structure:\n"
        "{\n"
        '  "brandAlignment": number (0-1),\n'
        '  "visualQuality": number (0-1),\n'
        '  "toneAccuracy": number (0-1),\n'
        '  "violations": ["string"],\n'
        '  "offBrandElements": ["string"],\n'
        '  "comprehensiveReport": "string",\n'
        '  "justifications": {\n'
        '    "brandAlignment": "string",\n'
        '    "visualQuality": "string",\n'
        '    "toneAccuracy": "string"\n'
        "  },\n"
        '  "validationPrompt": "string"\n'
        "}\n\n"
        "Requirements:\n"
        "1. Extract and synthesize scores from all reports to provide:\n"
        "   - brandAlignment: Overall brand alignment score (0-1)\n"
        "   - visualQuality: Visual quality score (0-1)\n"
        "   - toneAccuracy: Tone accuracy score (0-1)\n"
        "2. Compile all violations from safety/ethics and brand alignment reports\n"
        "3. List all off-brand elements identified across all agents\n"
        "4. Write a comprehensive report that summarizes all findings\n"
        "5. Provide justifications for each score\n"
        "6. Generate a validationPrompt that should be appended to the original prompt. "
        "This prompt should include specific instructions to address any issues found, "
        "improve scores, and ensure compliance. Format it as clear, actionable instructions "
        "that can be directly appended to the original video generation prompt.\n\n"
        "The validationPrompt is critical - it should be specific, actionable, and address "
        "all identified issues while maintaining the original creative intent."
    )


def run_advisor_agent(request: AdvisorRequest) -> AdvisorResult:
    """Execute the advisor agent and return a structured result."""
    if USE_DUMMY_ADVISOR:
        brand = request.brand_context
        brand_description = f"{brand.company_name}'s {brand.product_name}".strip()

        report = {
            "brandAlignment": 0.5,
            "visualQuality": 0.5,
            "toneAccuracy": 0.5,
            "violations": [],
            "offBrandElements": [],
            "comprehensiveReport": (
                f"Dummy advisor report for {brand_description}. "
                "Real aggregation skipped to save credits."
            ),
            "justifications": {
                "brandAlignment": "Dummy mode - not calculated",
                "visualQuality": "Dummy mode - not calculated",
                "toneAccuracy": "Dummy mode - not calculated",
            },
            "validationPrompt": (
                "Dummy validation prompt. Disable USE_DUMMY_ADVISOR to generate real prompt."
            ),
        }

        return AdvisorResult(
            report=report,
            prompt="DUMMY_MODE: Advisor agent skipped",
            validation_prompt=report["validationPrompt"],
            warnings=[
                "USE_DUMMY_ADVISOR is enabled – no Gemini tokens consumed for advisor aggregation."
            ],
        )

    client = get_genai_client()

    prompt = _build_prompt(request)
    logger.info("Generating comprehensive advisor report with Gemini...")

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
    logger.debug("Advisor raw response length: %d", len(response_text))

    report = _parse_json_response(response_text)
    
    # Ensure validationPrompt exists in the report
    validation_prompt = report.get("validationPrompt", "")
    if not validation_prompt:
        logger.warning("Advisor report did not include validationPrompt, generating fallback")
        validation_prompt = (
            "Please ensure the video adheres to brand guidelines, maintains high visual quality, "
            "and accurately represents the product and messaging."
        )

    return AdvisorResult(
        report=report,
        prompt=prompt,
        validation_prompt=validation_prompt,
        warnings=[],
    )

