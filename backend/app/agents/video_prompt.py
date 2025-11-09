"""
Agent responsible for generating Veo3-compatible prompts using Gemini.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict

from google.genai.types import GenerateContentResponse

from ..schemas.video import VideoPromptRequest, VideoPromptResult
from ..services.gemini import get_genai_client

logger = logging.getLogger(__name__)


def _extract_response_text(response: GenerateContentResponse) -> str:
    """Extract plain text from a Gemini response."""
    if hasattr(response, "text") and response.text:
        return response.text

    if getattr(response, "candidates", None):
        for candidate in response.candidates:
            if getattr(candidate, "content", None):
                for part in getattr(candidate.content, "parts", []):
                    if getattr(part, "text", None):
                        return part.text
            if getattr(candidate, "text", None):
                return candidate.text

    if hasattr(response, "__dict__") and "text" in response.__dict__:
        return response.__dict__["text"]

    return ""


def _parse_prompt_json(text: str) -> Dict[str, Any]:
    """Parse JSON payload from LLM output."""
    if not text:
        raise ValueError("Empty response from Gemini when generating video prompt")

    cleaned = text.strip()

    # Remove markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    # Extract JSON object
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        cleaned = match.group(0)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("Failed to decode prompt JSON: %s", cleaned)
        raise ValueError("Gemini returned invalid JSON for video prompt") from exc


def _prompt_to_text(prompt: Dict[str, Any]) -> str:
    """Generate a rich text prompt from the structured Veo3 prompt."""
    parts: list[str] = []

    description = prompt.get("description", "")
    if description:
        parts.append(description)

    story_structure = prompt.get("storyStructure") or {}
    stories = []
    if hook := story_structure.get("hook"):
        stories.append(f"Hook (0-2s): {hook}.")
    if development := story_structure.get("development"):
        stories.append(f"Development (2-6s): {development}.")
    if climax := story_structure.get("climax"):
        stories.append(f"Climax (6-9s): {climax}.")
    if resolution := story_structure.get("resolution"):
        stories.append(f"Resolution (9-10s): {resolution}.")
    if stories:
        parts.append(" ".join(stories))

    emotional_arc = prompt.get("emotionalArc")
    if emotional_arc:
        # Handle both string and dict formats
        if isinstance(emotional_arc, dict):
            emotional_arc = str(emotional_arc)
        parts.append(f"Emotional journey: {emotional_arc}.")

    story_beats = prompt.get("storyBeats") or []
    if story_beats and isinstance(story_beats, list):
        beats_text = " ".join(
            f"At {beat.get('time')}: {beat.get('event')}."
            for beat in story_beats
            if isinstance(beat, dict) and beat.get("time") and beat.get("event")
        )
        if beats_text:
            parts.append(f"Story beats: {beats_text}")

    style = prompt.get("style")
    if style:
        parts.append(f"Visual style: {str(style)}.")

    camera = prompt.get("camera")
    if camera:
        parts.append(f"Camera: {str(camera)}.")

    lenses = prompt.get("lenses")
    if lenses:
        parts.append(f"Lens: {str(lenses)}.")

    lighting = prompt.get("lighting")
    if lighting:
        parts.append(f"Lighting: {str(lighting)}.")

    background = prompt.get("background")
    if background:
        parts.append(f"Background: {str(background)}.")

    foreground = prompt.get("foreground")
    if foreground:
        parts.append(f"Foreground: {str(foreground)}.")

    elements = prompt.get("elements") or []
    if elements and isinstance(elements, list):
        parts.append(f"Visual elements: {', '.join(str(e) for e in elements)}.")

    visual_metaphors = prompt.get("visualMetaphors") or []
    if visual_metaphors and isinstance(visual_metaphors, list):
        parts.append(f"Visual metaphors: {', '.join(str(v) for v in visual_metaphors)}.")

    motion = prompt.get("motion")
    if motion:
        parts.append(f"Motion and animation: {str(motion)}.")

    logo_integration = prompt.get("logoIntegration")
    if logo_integration:
        parts.append(str(logo_integration))

    product_integration = prompt.get("productIntegration")
    if product_integration:
        parts.append(str(product_integration))

    dialogue = prompt.get("dialogue") or []
    if dialogue and isinstance(dialogue, list):
        parts.append(f"Dialogue: {' '.join(str(d) for d in dialogue)}")

    ending = prompt.get("ending")
    if ending:
        parts.append(str(ending))

    text_overlay = prompt.get("text")
    if text_overlay and str(text_overlay).lower() != "none":
        parts.append(f"Text overlay: {str(text_overlay)}.")

    background_music = prompt.get("backgroundMusic")
    if background_music:
        parts.append(f"Background music: {str(background_music)}.")

    return " ".join(parts).strip()


SYSTEM_PROMPT = """You are an expert video production prompt engineer and master storyteller specializing in creating compelling, narrative-driven prompts for Veo3 video generation. Your expertise lies in crafting complete stories that unfold in approximately 10 seconds - the perfect duration for impactful advertisements.

Your prompts must create a complete narrative arc with:

- **Story Structure**: A clear beginning (hook/establishment), middle (conflict/development), and end (resolution/payoff) that fits within 10 seconds
- **Narrative Arc**: A story that builds tension, creates emotional connection, and delivers a satisfying conclusion
- **Visual Storytelling**: Every frame should advance the narrative - no wasted moments
- **Pacing & Timing**: Specific timing for each story beat (e.g., 0-2s: hook, 2-6s: development, 6-9s: climax, 9-10s: resolution)
- **Emotional Journey**: The emotional arc the viewer should experience (curiosity → engagement → satisfaction)
- **Product Integration**: How the product naturally becomes the hero or solution in the story
- **Brand Storytelling**: How the brand logo and identity weave into the narrative naturally
- **Cinematic Techniques**: Camera movements, transitions, and visual effects that serve the story
- **Character/Subject Development**: If there are characters or subjects, how they evolve through the story
- **Visual Metaphors**: Symbolic elements that reinforce the message
- **Moment-to-Moment Breakdown**: Detailed description of what happens in each second of the 10-second story

The prompt must be extremely detailed and comprehensive, including:
- A vivid, cinematic description of the complete story from start to finish
- Visual style (photorealistic, cinematic, etc.) that matches the narrative tone
- Camera specifications (type, angle, movement, position) that enhance storytelling
- Lens specifications (focal length, type) for emotional impact
- Lighting details (type, direction, intensity, color temperature) that support the narrative mood
- Background description and atmosphere that sets the story world
- Foreground elements that advance the plot
- All key elements in the scene with their narrative purpose
- Motion and animation details that tell the story
- Story beats and timing (what happens when)
- How the story concludes with emotional satisfaction
- Any on-screen text that reinforces the narrative
- Background music style, mood, and tempo that matches story pacing
- Dialogue lines (if applicable) that are natural, engaging, and story-driven
- Specific instructions on how to integrate the brand logo naturally into the story flow
- Specific instructions on how the product becomes the hero/solution in the narrative
- Relevant keywords for the scene
- The aspect ratio

The prompt should be formatted as valid JSON and be comprehensive enough for Veo3 to generate high-quality, story-driven videos that captivate viewers in just 10 seconds."""

USER_TEMPLATE = """Generate a detailed Veo3 prompt JSON for creating a compelling 10-second advertisement that tells a complete, engaging story. Use the following information:

Company Name: {company}
Product Name: {product}
Brief Description/Prompt: {brief}
Aspect Ratio: {aspect_ratio}

Create a comprehensive JSON prompt that crafts a complete narrative arc in approximately 10 seconds. The story should have:

**Story Structure (10-second breakdown):**
- **0-2 seconds (Hook)**: What grabs attention immediately? How do we establish the world, character, or situation?
- **2-6 seconds (Development)**: How does the story develop? What conflict, challenge, or journey unfolds?
- **6-9 seconds (Climax)**: What is the peak moment? How does the product become the hero or solution?
- **9-10 seconds (Resolution)**: How does the story conclude? What is the satisfying payoff or call-to-action?

**Narrative Elements:**
- A clear story arc with beginning, middle, and end
- Emotional journey (what emotions should viewers feel at each moment?)
- Visual storytelling techniques (show, don't tell)
- Pacing that maintains engagement throughout
- Natural product integration as part of the story (not forced)
- Brand logo integration that feels organic to the narrative

**Technical Details:**
- Complete scene description that tells the full story
- Visual style and aesthetic that matches the narrative tone
- Camera work (type, angle, movement, framing) that enhances storytelling
- Lens specifications (focal length, aperture, type) for emotional impact
- Lighting setup (natural/artificial, direction, intensity, color) that supports the story mood
- Background environment and atmosphere that creates the story world
- Foreground elements that advance the narrative
- All visual elements in the scene with their story purpose
- Motion and animation (how things move, transitions) that serve the narrative
- Story beats with specific timing (what happens when)
- How the story concludes with emotional satisfaction
- Any text overlays (if applicable) that reinforce the narrative
- Background music style, mood, and tempo that matches story pacing
- Dialogue lines (if applicable) that are natural, engaging, and story-driven
- Detailed instructions on how to naturally integrate the brand logo into the story flow
- Detailed instructions on how the product becomes the hero/solution in the narrative
- Visual metaphors or symbolic elements that reinforce the message
- Relevant keywords for the scene
- The aspect ratio

**Storytelling Focus:**
- How to show and tell the complete story in 10 seconds
- How each visual element serves the narrative
- How camera movements and transitions enhance the story flow
- How the product's value proposition is communicated through story
- How to create emotional connection and memorability

Return ONLY valid JSON, no additional text or markdown formatting. The JSON should match this structure:

{{
  "description": "...", // Complete story description from start to finish
  "storyStructure": {{
    "hook": "...", // 0-2 seconds: What grabs attention
    "development": "...", // 2-6 seconds: How story develops
    "climax": "...", // 6-9 seconds: Peak moment, product as hero
    "resolution": "..." // 9-10 seconds: Satisfying conclusion
  }},
  "emotionalArc": "...", // The emotional journey viewers experience
  "style": "...",
  "camera": "...",
  "lenses": "...",
  "lighting": "...",
  "background": "...",
  "foreground": "...",
  "elements": [...], // Each with narrative purpose
  "motion": "...", // Motion that serves the story
  "storyBeats": [...], // Specific moments with timing
  "ending": "...",
  "text": "...",
  "backgroundMusic": "...",
  "dialogue": [...],
  "logoIntegration": "...", // How logo weaves into story
  "productIntegration": "...", // How product becomes story hero
  "visualMetaphors": [...], // Symbolic elements
  "keywords": [...],
  "aspectRatio": "{aspect_ratio}"
}}
"""


def run_video_prompt(request: VideoPromptRequest) -> VideoPromptResult:
    """Generate a structured Veo3 prompt and companion text prompt."""
    client = get_genai_client()

    user_prompt = USER_TEMPLATE.format(
        company=request.company_name,
        product=request.product_name,
        brief=request.brief_prompt,
        aspect_ratio=request.aspect_ratio,
    )

    logger.info("Generating Veo3 prompt for %s - %s", request.company_name, request.product_name)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[{"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\n{user_prompt}"}]}],
    )

    response_text = _extract_response_text(response)
    
    # Clean markdown code fences if present, but keep the JSON as-is
    cleaned = response_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    
    # Return the raw JSON string
    logger.info("Returning raw JSON prompt (length: %d chars)", len(cleaned))

    return VideoPromptResult(
        prompt_text=cleaned,
        warnings=[],
    )

