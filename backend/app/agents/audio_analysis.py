"""
Audio analysis agent.

The agent analyzes the audio track of an advertisement video using Gemini with audio input.
It assesses tone of voice, music, sound effects, and overall audio quality for brand alignment.
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

from ..schemas.critique import AudioAnalysisRequest, AudioAnalysisResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


USE_DUMMY_AUDIO_ANALYSIS = os.getenv("USE_DUMMY_AUDIO_ANALYSIS", "false").lower() in {
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


def _build_prompt(request: AudioAnalysisRequest) -> str:
    """Create the system prompt sent to Gemini."""
    context = request.brand_context
    brief = (
        f"\n- Creative Brief: {context.brief_prompt}"
        if context.brief_prompt
        else ""
    )

    return (
        "You are an audio analysis expert for brand advertisement evaluation.\n\n"
        "BRAND CONTEXT:\n"
        f"- Company: {context.company_name}\n"
        f"- Product: {context.product_name}{brief}\n\n"
        "Please analyze the audio track of the provided video and respond with JSON using the "
        "following schema:\n"
        "{\n"
        '  "toneOfVoice": {\n'
        '    "score": 0.0-1.0,\n'
        '    "analysis": "string",\n'
        '    "characteristics": ["string"],\n'
        '    "brandAlignment": "string"\n'
        "  },\n"
        '  "music": {\n'
        '    "score": 0.0-1.0,\n'
        '    "analysis": "string",\n'
        '    "style": "string",\n'
        '    "volume": "string",\n'
        '    "brandAlignment": "string"\n'
        "  },\n"
        '  "soundEffects": {\n'
        '    "score": 0.0-1.0,\n'
        '    "analysis": "string",\n'
        '    "presence": "string",\n'
        '    "quality": "string"\n'
        "  },\n"
        '  "audioQuality": {\n'
        '    "score": 0.0-1.0,\n'
        '    "analysis": "string",\n'
        '    "clarity": "string",\n'
        '    "balance": "string"\n'
        "  },\n"
        '  "overallAudioScore": 0.0-1.0,\n'
        '  "keyStrengths": ["string"],\n'
        '  "keyWeaknesses": ["string"],\n'
        '  "recommendations": ["string"]\n'
        "}\n\n"
        "Focus on:\n"
        "1. How well the tone of voice matches the brand identity\n"
        "2. Whether the music style and mood align with brand values\n"
        "3. Quality and appropriateness of sound effects\n"
        "4. Overall audio production quality\n"
        "5. Brand alignment of all audio elements\n\n"
        "Provide thoughtful commentary and make sure all scores fall between 0 and 1."
    )


def _wait_for_file_ready(
    client,
    uploaded_file,
    max_wait_seconds: int = 300,
    poll_interval: int = 2,
) -> None:
    """Wait for an uploaded file to become ACTIVE/ready for use."""
    start_time = time.time()
    file_name = uploaded_file.name if hasattr(uploaded_file, "name") else str(uploaded_file.uri).split("/")[-1]
    
    while time.time() - start_time < max_wait_seconds:
        try:
            file_info = client.files.get(name=file_name)
            
            state = None
            
            # Try direct attribute access
            if hasattr(file_info, "state"):
                state = file_info.state
            elif hasattr(file_info, "status"):
                state = file_info.status
            
            # Try accessing via model_dump if it's a Pydantic model
            if state is None and hasattr(file_info, "model_dump"):
                file_dict = file_info.model_dump()
                state = file_dict.get("state") or file_dict.get("status")
            
            # Check if ACTIVE
            state_str = str(state) if state else None
            if state_str and ("ACTIVE" in state_str.upper() or state == "ACTIVE"):
                logger.info("File %s is now ACTIVE", file_name)
                return
            
            # Log current state
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


def run_audio_analysis(request: AudioAnalysisRequest) -> AudioAnalysisResult:
    """Execute the audio analysis agent and return a structured result."""
    
    if USE_DUMMY_AUDIO_ANALYSIS:
        brand = request.brand_context
        brand_description = f"{brand.company_name}'s {brand.product_name}".strip()
        
        report = {
            "toneOfVoice": {
                "score": 0.5,
                "analysis": f"Placeholder tone of voice evaluation for {brand_description}.",
                "characteristics": ["Dummy mode active"],
                "brandAlignment": "Not assessed in dummy mode",
            },
            "music": {
                "score": 0.5,
                "analysis": "Music analysis not executed in dummy mode.",
                "style": "Unknown",
                "volume": "Unknown",
                "brandAlignment": "Not assessed",
            },
            "soundEffects": {
                "score": 0.5,
                "analysis": "Sound effects not analyzed in dummy mode.",
                "presence": "Unknown",
                "quality": "Unknown",
            },
            "audioQuality": {
                "score": 0.5,
                "analysis": "Audio quality not assessed in dummy mode.",
                "clarity": "Unknown",
                "balance": "Unknown",
            },
            "overallAudioScore": 0.5,
            "keyStrengths": ["Dummy result created to conserve Gemini credits."],
            "keyWeaknesses": ["Authentic audio analysis not generated"],
            "recommendations": [
                "Disable USE_DUMMY_AUDIO_ANALYSIS to run the actual audio analysis agent.",
            ],
        }
        
        return AudioAnalysisResult(
            report=report,
            prompt="DUMMY_MODE: Audio analysis skipped",
            warnings=[
                "USE_DUMMY_AUDIO_ANALYSIS is enabled – no Gemini credits consumed."
            ],
            raw_text="Dummy audio analysis output.",
        )
    
    stripped = _strip_data_uri_prefix(request.video_base64)
    decoded_bytes = _decode_base64(stripped)
    
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_video_file:
        temp_video_file.write(decoded_bytes)
        temp_video_path = temp_video_file.name
    
    client = get_genai_client()
    
    try:
        # Upload the video file (Gemini can analyze audio from video)
        logger.info("Uploading video file to Google GenAI for audio analysis...")
        uploaded_video = client.files.upload(file=temp_video_path)
        logger.info("Video uploaded, URI: %s", uploaded_video.uri if hasattr(uploaded_video, "uri") else "N/A")
        
        # Wait for file to be ready
        logger.info("Waiting for file to become ACTIVE...")
        _wait_for_file_ready(client, uploaded_video)
        
        # Build prompt
        prompt = _build_prompt(request)
        
        # Generate content with audio analysis
        logger.info("Generating audio analysis with Gemini...")
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
        parsed_json, warnings = _parse_json_payload(response_text)
        
        logger.info("Audio analysis completed successfully")
        
        return AudioAnalysisResult(
            report=parsed_json,
            prompt=prompt,
            warnings=warnings,
            raw_text=response_text,
        )
        
    finally:
        # Clean up temp file
        try:
            os.unlink(temp_video_path)
        except Exception as exc:
            logger.warning("Failed to delete temp video file: %s", exc)

