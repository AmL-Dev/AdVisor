"""
Safety and Ethics agent.

The agent analyzes the video for harmful content, stereotypes, misleading claims,
and ethical concerns. It provides feedback on what needs to be updated.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
import time
from typing import Any, Dict, List, Tuple

from google.genai.types import GenerateContentResponse

from ..schemas.critique import SafetyEthicsRequest, SafetyEthicsResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


USE_DUMMY_SAFETY_ETHICS = os.getenv("USE_DUMMY_SAFETY_ETHICS", "false").lower() in {
    "1",
    "true",
    "yes",
    "on",
}


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


def _extract_response_text(response: GenerateContentResponse) -> str:
    """
    Attempt to extract the textual payload from a Gemini response.
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


def _parse_json_payload(text: str) -> Tuple[Dict[str, Any], List[str]]:
    """
    Parse JSON from the Gemini response. Returns the parsed dict and warnings.
    """
    warnings: List[str] = []
    cleaned = text.strip()

    if not cleaned:
        warnings.append("Empty response body received from Gemini")
        return {}, warnings

    # Remove optional Markdown fences (```json ... ```)
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    json_start = cleaned.find("{")
    json_end = cleaned.rfind("}")
    if json_start == -1 or json_end == -1:
        warnings.append("Gemini response did not contain JSON; returning raw text")
        return {"rawText": cleaned}, warnings

    json_blob = cleaned[json_start : json_end + 1]

    try:
        return json.loads(json_blob), warnings
    except json.JSONDecodeError as exc:
        warnings.append(f"Failed to parse JSON payload: {exc}")
        return {"rawText": cleaned}, warnings


def _build_prompt(request: SafetyEthicsRequest) -> str:
    """Create the system prompt sent to Gemini."""
    context = request.brand_context
    brief = (
        f"\n- Creative Brief: {context.brief_prompt}"
        if context.brief_prompt
        else ""
    )

    return (
        "You are a safety and ethics evaluator for brand advertisements.\n\n"
        "BRAND CONTEXT:\n"
        f"- Company: {context.company_name}\n"
        f"- Product: {context.product_name}{brief}\n\n"
        "Please review the provided video and assess it for safety and ethical concerns. "
        "Focus on:\n"
        "1. Harmful content (violence, dangerous activities, inappropriate material)\n"
        "2. Stereotypes (gender, racial, cultural, or other harmful stereotypes)\n"
        "3. Misleading claims (false advertising, exaggerated benefits, deceptive practices)\n"
        "4. Ethical violations (privacy concerns, manipulation, exploitation)\n\n"
        "Respond with JSON using the following schema:\n"
        "{\n"
        '  "safetyScore": 0.0-1.0,\n'
        '  "ethicsScore": 0.0-1.0,\n'
        '  "harmfulContent": {\n'
        '    "detected": boolean,\n'
        '    "issues": ["string"],\n'
        '    "severity": "none|low|medium|high"\n'
        "  },\n"
        '  "stereotypes": {\n'
        '    "detected": boolean,\n'
        '    "issues": ["string"],\n'
        '    "severity": "none|low|medium|high"\n'
        "  },\n"
        '  "misleadingClaims": {\n'
        '    "detected": boolean,\n'
        '    "issues": ["string"],\n'
        '    "severity": "none|low|medium|high"\n'
        "  },\n"
        '  "ethicalViolations": {\n'
        '    "detected": boolean,\n'
        '    "issues": ["string"],\n'
        '    "severity": "none|low|medium|high"\n'
        "  },\n"
        '  "overallAssessment": "string",\n'
        '  "recommendations": ["string"],\n'
        '  "requiresUpdate": boolean,\n'
        '  "updateFeedback": "string"\n'
        "}\n\n"
        "Provide detailed feedback on any issues found. If issues are detected, "
        "provide specific recommendations on what needs to be updated. "
        "Scores should reflect the severity of issues (1.0 = no issues, 0.0 = critical issues)."
    )


def _wait_for_file_active(client, file_obj, max_wait_seconds: int = 120) -> None:
    """
    Wait for an uploaded file to become ACTIVE before using it.
    """
    start_time = time.time()
    poll_interval = 2
    
    file_name = None
    if hasattr(file_obj, "name"):
        file_name = file_obj.name
        if not file_name.startswith("files/"):
            file_name = f"files/{file_name}"
    elif hasattr(file_obj, "uri"):
        uri = file_obj.uri
        if "/files/" in uri:
            file_name = uri.split("/files/")[-1]
            if not file_name.startswith("files/"):
                file_name = f"files/{file_name}"
        else:
            file_name = uri
    
    if not file_name:
        logger.warning("Could not determine file name from file object, skipping wait check")
        time.sleep(3)
        return
    
    logger.info("Waiting for file %s to become ACTIVE...", file_name)
    
    while time.time() - start_time < max_wait_seconds:
        try:
            file_info = client.files.get(name=file_name)
            
            state = None
            if hasattr(file_info, "state"):
                state = file_info.state
            elif hasattr(file_info, "status"):
                state = file_info.status
            
            if state is None and hasattr(file_info, "model_dump"):
                file_dict = file_info.model_dump()
                state = file_dict.get("state") or file_dict.get("status")
            
            state_str = str(state) if state else None
            if state_str and ("ACTIVE" in state_str.upper() or state == "ACTIVE"):
                logger.info("File %s is now ACTIVE", file_name)
                return
            
            elapsed = int(time.time() - start_time)
            logger.debug(
                "File %s state: %s (elapsed: %ds), waiting...",
                file_name,
                state_str or "unknown",
                elapsed,
            )
            time.sleep(poll_interval)
            
        except Exception as exc:
            elapsed = int(time.time() - start_time)
            logger.warning(
                "Error checking file status (elapsed: %ds): %s, continuing...",
                elapsed,
                exc,
            )
            time.sleep(poll_interval)
    
    raise TimeoutError(
        f"File {file_name} did not become ACTIVE within {max_wait_seconds} seconds"
    )


def run_safety_ethics(request: SafetyEthicsRequest) -> SafetyEthicsResult:
    """Execute the safety and ethics agent and return a structured result."""

    if USE_DUMMY_SAFETY_ETHICS:
        brand = request.brand_context
        brand_description = f"{brand.company_name}'s {brand.product_name}".strip()

        report = {
            "safetyScore": 1.0,
            "ethicsScore": 1.0,
            "harmfulContent": {
                "detected": False,
                "issues": [],
                "severity": "none",
            },
            "stereotypes": {
                "detected": False,
                "issues": [],
                "severity": "none",
            },
            "misleadingClaims": {
                "detected": False,
                "issues": [],
                "severity": "none",
            },
            "ethicalViolations": {
                "detected": False,
                "issues": [],
                "severity": "none",
            },
            "overallAssessment": (
                f"Dummy safety and ethics evaluation for {brand_description}. "
                "Real analysis skipped to save credits."
            ),
            "recommendations": [
                "Disable USE_DUMMY_SAFETY_ETHICS to run the actual safety and ethics agent.",
            ],
            "requiresUpdate": False,
            "updateFeedback": "No issues detected in dummy mode.",
        }

        return SafetyEthicsResult(
            report=report,
            prompt="DUMMY_MODE: Safety and ethics analysis skipped",
            warnings=[
                "USE_DUMMY_SAFETY_ETHICS is enabled – no Gemini credits consumed."
            ],
            raw_text="Dummy safety and ethics output.",
        )

    stripped = _strip_data_uri_prefix(request.video_base64)
    decoded_bytes = _decode_base64(stripped)

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video_file:
        temp_video_file.write(decoded_bytes)
        temp_video_path = temp_video_file.name

    client = get_genai_client()

    try:
        logger.info("Uploading video file to Google GenAI for safety and ethics analysis...")
        uploaded_video = client.files.upload(file=temp_video_path)
        logger.info("Video uploaded, URI: %s", uploaded_video.uri if hasattr(uploaded_video, "uri") else "N/A")
        
        logger.info("Waiting for file to become ACTIVE...")
        _wait_for_file_active(client, uploaded_video)
        
        prompt = _build_prompt(request)
        logger.info("Generating safety and ethics analysis with Gemini...")

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "file_data": {
                                "file_uri": uploaded_video.uri,
                                "mime_type": uploaded_video.mime_type,
                            }
                        },
                    ],
                }
            ],
        )

        response_text = _extract_response_text(response)
        parsed_payload, warnings = _parse_json_payload(response_text)

        return SafetyEthicsResult(
            report=parsed_payload,
            prompt=prompt,
            warnings=warnings,
            raw_text=response_text,
        )
    finally:
        try:
            os.remove(temp_video_path)
        except OSError:
            logger.debug("Temporary video file %s already removed", temp_video_path)

