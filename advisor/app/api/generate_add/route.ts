import { NextRequest, NextResponse } from "next/server";

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

const backendBaseUrl =
  process.env.BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://127.0.0.1:8000";

interface BackendPromptResponse {
  promptText: string; // Raw JSON prompt as a string
  warnings?: string[];
}

interface BackendVideoResponse {
  video: string;
  promptText: string;
  warnings?: string[];
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

    // Request prompt generation from backend agent
    const promptResponse = await fetch(`${backendBaseUrl}/agents/video-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: body.companyName,
        productName: body.productName,
        briefPrompt: body.briefPrompt,
        aspectRatio,
      }),
    });

    const promptPayload = await promptResponse.json();

    if (!promptResponse.ok) {
      return NextResponse.json(
        {
          error: promptPayload?.detail || promptPayload?.error || "Failed to generate prompt",
        },
        { status: promptResponse.status }
      );
    }

    const promptData = promptPayload as BackendPromptResponse;

    if (!promptData.promptText) {
      return NextResponse.json(
        { error: "Prompt generation response missing prompt text." },
        { status: 500 }
      );
    }

    if (body.validatePrompt) {
      return NextResponse.json({
        promptText: promptData.promptText,
        status: "pending_validation",
        message: "Prompt generated. Please review and confirm to proceed with video generation.",
      });
    }

    const videoResponse = await fetch(`${backendBaseUrl}/agents/video-generation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptText: promptData.promptText,
        brandLogo: body.brandLogo,
        productImage: body.productImage,
        aspectRatio,
      }),
    });

    const videoPayload = await videoResponse.json();

    if (!videoResponse.ok) {
      return NextResponse.json(
        {
          error: videoPayload?.detail || videoPayload?.error || "Failed to generate video",
          promptText: promptData.promptText,
        },
        { status: videoResponse.status }
      );
    }

    const videoData = videoPayload as BackendVideoResponse;

    return NextResponse.json({
      success: true,
      video: videoData.video,
      promptText: videoData.promptText,
      message: "Video generated successfully",
    });
  } catch (error) {
    console.error("Error generating ad:", error);
    return NextResponse.json(
      {
        error: "Failed to generate ad",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

