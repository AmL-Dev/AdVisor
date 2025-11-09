import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "21:9"] as const;
type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

interface ConfirmAdRequest {
  companyName: string;
  productName: string;
  brandLogo: string;
  productImage: string;
  veo3Prompt?: any; // Optional: parsed prompt object (if frontend parsed the JSON)
  promptText: string; // Raw JSON prompt as a string
  aspectRatio?: AspectRatio;
}

const backendBaseUrl =
  process.env.BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://127.0.0.1:8000";

/**
 * Confirmation endpoint - generates video after prompt validation
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConfirmAdRequest = await request.json();

    // Validate required fields
    if (
      !body.companyName ||
      !body.productName ||
      !body.brandLogo ||
      !body.productImage ||
      !body.promptText
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: companyName, productName, brandLogo, productImage, promptText",
        },
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

    const videoResponse = await fetch(`${backendBaseUrl}/agents/video-generation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptText: body.promptText,
        brandLogo: body.brandLogo,
        productImage: body.productImage,
        aspectRatio,
      }),
    });

    const payload = await videoResponse.json();

    if (!videoResponse.ok) {
      return NextResponse.json(
        {
          error: payload?.detail || payload?.error || "Failed to generate video",
        },
        { status: videoResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      video: payload.video,
      prompt: body.veo3Prompt,
      promptText: payload.promptText ?? body.promptText,
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

