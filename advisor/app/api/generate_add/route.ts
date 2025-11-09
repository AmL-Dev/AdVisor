import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { generateVideoWithVeo3, promptToText, Veo3Prompt } from "./utils";

// Supported aspect ratios for Veo3
const SUPPORTED_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "21:9"] as const;
type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

interface GenerateAdRequest {
  companyName: string;
  productName: string;
  brandLogo: string; // Base64 encoded image
  productImage: string; // Base64 encoded image
  briefPrompt: string;
  aspectRatio?: AspectRatio;
  validatePrompt?: boolean; // If true, return prompt for validation before generating
}


const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Generate a detailed Veo3 prompt using Gemini 2.5 Flash-Lite
 */
async function generateVeo3Prompt(
  companyName: string,
  productName: string,
  briefPrompt: string,
  aspectRatio: AspectRatio
): Promise<Veo3Prompt> {
  const systemPrompt = `You are an expert video production prompt engineer and master storyteller specializing in creating compelling, narrative-driven prompts for Veo3 video generation. Your expertise lies in crafting complete stories that unfold in approximately 10 seconds - the perfect duration for impactful advertisements.

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

The prompt should be formatted as valid JSON and be comprehensive enough for Veo3 to generate high-quality, story-driven videos that captivate viewers in just 10 seconds.`;

  const userPrompt = `Generate a detailed Veo3 prompt JSON for creating a compelling 10-second advertisement that tells a complete, engaging story. Use the following information:

Company Name: ${companyName}
Product Name: ${productName}
Brief Description/Prompt: ${briefPrompt}
Aspect Ratio: ${aspectRatio}

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
{
  "description": "...", // Complete story description from start to finish
  "storyStructure": {
    "hook": "...", // 0-2 seconds: What grabs attention
    "development": "...", // 2-6 seconds: How story develops
    "climax": "...", // 6-9 seconds: Peak moment, product as hero
    "resolution": "..." // 9-10 seconds: Satisfying conclusion
  },
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
  "aspectRatio": "${aspectRatio}"
}`;

  try {
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}\n\nRemember: Return ONLY valid JSON, no markdown, no code blocks, no additional text.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
    });

    let responseText = "";
    
    // Try different response structures
    if (typeof response.text === "string") {
      responseText = response.text.trim();
    } else if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        responseText = candidate.content.parts[0].text?.trim() || "";
      } else if ((candidate as any).text) {
        responseText = (candidate as any).text.trim();
      }
    } else if ((response as any).text) {
      responseText = (response as any).text.trim();
    }
    
    if (!responseText) {
      console.error("Response structure:", JSON.stringify(response, null, 2));
      throw new Error("Empty response from Gemini API - unable to extract text");
    }
    
    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = responseText;
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    
    // Try to find JSON object in the response
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const prompt: Veo3Prompt = JSON.parse(jsonText);
    
    // Validate required fields
    if (!prompt.description || !prompt.style || !prompt.camera || !prompt.lighting) {
      throw new Error("Generated prompt is missing required fields");
    }
    
    return prompt;
  } catch (error) {
    console.error("Error generating Veo3 prompt:", error);
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON from Gemini response: ${error.message}`);
    }
    throw new Error(`Failed to generate Veo3 prompt: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}



export async function POST(request: NextRequest) {
  try {
    const body: GenerateAdRequest = await request.json();
    
    // Validate required fields
    if (!body.companyName || !body.productName || !body.brandLogo || !body.productImage || !body.briefPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: companyName, productName, brandLogo, productImage, briefPrompt" },
        { status: 400 }
      );
    }
    
    // Validate aspect ratio
    const aspectRatio: AspectRatio = body.aspectRatio || "16:9";
    if (!SUPPORTED_ASPECT_RATIOS.includes(aspectRatio)) {
      return NextResponse.json(
        { error: `Invalid aspect ratio. Supported: ${SUPPORTED_ASPECT_RATIOS.join(", ")}` },
        { status: 400 }
      );
    }
    
    // Generate detailed Veo3 prompt using Gemini
    const veo3Prompt = await generateVeo3Prompt(
      body.companyName,
      body.productName,
      body.briefPrompt,
      aspectRatio
    );
    
    // If validation is requested, return the prompt for review
    if (body.validatePrompt) {
      return NextResponse.json({
        prompt: veo3Prompt,
        promptText: promptToText(veo3Prompt),
        status: "pending_validation",
        message: "Prompt generated. Please review and confirm to proceed with video generation."
      });
    }
    
    // Convert prompt to text format for Veo3
    const veo3TextPrompt = promptToText(veo3Prompt);
    
    // Generate video using shared utility function
    try {
      const result = await generateVideoWithVeo3(
        veo3TextPrompt,
        body.brandLogo,
        body.productImage
      );
      
      return NextResponse.json({
        success: true,
        video: result.video,
        prompt: veo3Prompt,
        promptText: veo3TextPrompt,
        message: "Video generated successfully"
      });
    } catch (videoError: any) {
      return NextResponse.json(
        { 
          error: "Failed to generate video", 
          details: videoError.message 
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error generating ad:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate ad", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

