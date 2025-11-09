import { NextRequest, NextResponse } from "next/server";
import { generateVideoWithVeo3, promptToText } from "../utils";

const SUPPORTED_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "21:9"] as const;
type AspectRatio = typeof SUPPORTED_ASPECT_RATIOS[number];

interface ConfirmAdRequest {
  companyName: string;
  productName: string;
  brandLogo: string;
  productImage: string;
  veo3Prompt: any; // The validated prompt object
  aspectRatio?: AspectRatio;
}




/**
 * Confirmation endpoint - generates video after prompt validation
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConfirmAdRequest = await request.json();
    
    // Validate required fields
    if (!body.companyName || !body.productName || !body.brandLogo || !body.productImage || !body.veo3Prompt) {
      return NextResponse.json(
        { error: "Missing required fields: companyName, productName, brandLogo, productImage, veo3Prompt" },
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
    
    // Convert prompt to text format for Veo3
    const veo3TextPrompt = promptToText(body.veo3Prompt);
    
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
        prompt: body.veo3Prompt,
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

