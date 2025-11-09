import { GoogleGenAI } from "@google/genai";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Veo3 Prompt interface
 */
export interface Veo3Prompt {
  description: string;
  storyStructure?: {
    hook?: string;
    development?: string;
    climax?: string;
    resolution?: string;
  };
  emotionalArc?: string;
  style: string;
  camera: string;
  lenses?: string;
  lighting: string;
  background?: string;
  foreground?: string;
  elements: string[];
  motion: string;
  storyBeats?: Array<{ time: string; event: string }>;
  ending: string;
  text?: string;
  backgroundMusic?: string;
  dialogue?: string[];
  logoIntegration: string;
  productIntegration: string;
  visualMetaphors?: string[];
  keywords: string[];
  aspectRatio: string;
}

/**
 * Convert Veo3 prompt JSON to a text prompt for Veo3 API
 * This function creates a comprehensive narrative-driven prompt
 */
export function promptToText(prompt: Veo3Prompt): string {
  let textPrompt = prompt.description;
  
  // Add story structure if available (this is the key storytelling element)
  if (prompt.storyStructure) {
    textPrompt += ` Story structure: `;
    if (prompt.storyStructure.hook) {
      textPrompt += `Hook (0-2s): ${prompt.storyStructure.hook}. `;
    }
    if (prompt.storyStructure.development) {
      textPrompt += `Development (2-6s): ${prompt.storyStructure.development}. `;
    }
    if (prompt.storyStructure.climax) {
      textPrompt += `Climax (6-9s): ${prompt.storyStructure.climax}. `;
    }
    if (prompt.storyStructure.resolution) {
      textPrompt += `Resolution (9-10s): ${prompt.storyStructure.resolution}. `;
    }
  }
  
  // Add emotional arc
  if (prompt.emotionalArc) {
    textPrompt += ` Emotional journey: ${prompt.emotionalArc}.`;
  }
  
  // Add story beats with timing
  if (prompt.storyBeats && prompt.storyBeats.length > 0) {
    textPrompt += ` Story beats: `;
    prompt.storyBeats.forEach(beat => {
      textPrompt += `At ${beat.time}: ${beat.event}. `;
    });
  }
  
  // Add style
  if (prompt.style) {
    textPrompt += ` Visual style: ${prompt.style}.`;
  }
  
  // Add camera details
  if (prompt.camera) {
    textPrompt += ` Camera: ${prompt.camera}.`;
  }
  
  if (prompt.lenses) {
    textPrompt += ` Lens: ${prompt.lenses}.`;
  }
  
  // Add lighting
  if (prompt.lighting) {
    textPrompt += ` Lighting: ${prompt.lighting}.`;
  }
  
  // Add background
  if (prompt.background) {
    textPrompt += ` Background: ${prompt.background}.`;
  }
  
  // Add foreground
  if (prompt.foreground) {
    textPrompt += ` Foreground: ${prompt.foreground}.`;
  }
  
  // Add elements with narrative purpose
  if (prompt.elements && prompt.elements.length > 0) {
    textPrompt += ` Visual elements: ${prompt.elements.join(", ")}.`;
  }
  
  // Add visual metaphors
  if (prompt.visualMetaphors && prompt.visualMetaphors.length > 0) {
    textPrompt += ` Visual metaphors: ${prompt.visualMetaphors.join(", ")}.`;
  }
  
  // Add motion that serves the story
  if (prompt.motion) {
    textPrompt += ` Motion and animation: ${prompt.motion}.`;
  }
  
  // Add logo integration in story context
  if (prompt.logoIntegration) {
    textPrompt += ` ${prompt.logoIntegration}`;
  }
  
  // Add product integration as story hero
  if (prompt.productIntegration) {
    textPrompt += ` ${prompt.productIntegration}`;
  }
  
  // Add dialogue
  if (prompt.dialogue && prompt.dialogue.length > 0) {
    textPrompt += ` Dialogue: ${prompt.dialogue.join(" ")}`;
  }
  
  // Add ending
  if (prompt.ending) {
    textPrompt += ` ${prompt.ending}`;
  }
  
  // Add text overlay
  if (prompt.text && prompt.text !== "none") {
    textPrompt += ` Text overlay: ${prompt.text}.`;
  }
  
  // Add background music
  if (prompt.backgroundMusic) {
    textPrompt += ` Background music: ${prompt.backgroundMusic}.`;
  }
  
  return textPrompt;
}

/**
 * Convert base64 string to image data for Veo3 API
 */
export function base64ToImageBytes(base64: string): { imageBytes: string; mimeType: string } {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  
  let mimeType = "image/png";
  if (base64.startsWith("data:image/jpeg") || base64.startsWith("data:image/jpg")) {
    mimeType = "image/jpeg";
  } else if (base64.startsWith("data:image/png")) {
    mimeType = "image/png";
  } else if (base64.startsWith("data:image/webp")) {
    mimeType = "image/webp";
  }
  
  return { imageBytes: base64Data, mimeType };
}

/**
 * Prepare reference images for Veo3 API
 */
export function prepareReferenceImages(brandLogo: string, productImage: string) {
  const productImageData = base64ToImageBytes(productImage);
  const logoImageData = base64ToImageBytes(brandLogo);
  
  // Clean base64 strings - remove any whitespace
  let productBase64 = productImageData.imageBytes.trim().replace(/\s/g, '');
  let logoBase64 = logoImageData.imageBytes.trim().replace(/\s/g, '');
  
  // Validate images are not empty
  if (!productBase64 || productBase64.length === 0) {
    throw new Error("Invalid product image data: base64 string is empty");
  }
  if (!logoBase64 || logoBase64.length === 0) {
    throw new Error("Invalid logo image data: base64 string is empty");
  }
  
  return {
    productBase64,
    logoBase64,
    productMimeType: productImageData.mimeType,
    logoMimeType: logoImageData.mimeType,
  };
}

/**
 * Generate video with Veo3 and download it
 */
export async function generateVideoWithVeo3(
  prompt: string,
  brandLogo: string,
  productImage: string
): Promise<{ video: string; prompt: string }> {
  // Prepare reference images
  const { productBase64, logoBase64, productMimeType, logoMimeType } = 
    prepareReferenceImages(brandLogo, productImage);
  
  // Generate video with Veo3 using referenceImages format
  let operation = await ai.models.generateVideos({
    model: "veo-3.1-generate-preview",
    prompt: prompt,
    referenceImages: [
      {
        image: {
          bytesBase64Encoded: productBase64,
          mimeType: productMimeType,
        },
        referenceType: "asset", // Product is an asset
      },
      {
        image: {
          bytesBase64Encoded: logoBase64,
          mimeType: logoMimeType,
        },
        referenceType: "style", // Logo defines style/branding
      },
    ],
  } as any);
  
  // Poll the operation status until the video is ready
  let pollCount = 0;
  const maxPolls = 60; // Maximum 10 minutes (60 * 10 seconds)
  
  while (!operation.done && pollCount < maxPolls) {
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
    operation = await ai.operations.getVideosOperation({
      operation: operation,
    });
    pollCount++;
  }
  
  if (!operation.done) {
    throw new Error("Video generation timed out. Please try again.");
  }
  
  // Get the generated video
  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo || !generatedVideo.video) {
    throw new Error("Video generation failed. No video was generated.");
  }
  
  // Download video file
  const tempFilePath = join(tmpdir(), `veo-video-${Date.now()}.mp4`);
  let videoBase64: string | null = null;
  
  try {
    // Download to temporary file
    await ai.files.download({
      file: generatedVideo.video,
      downloadPath: tempFilePath,
    });
    
    // Read the downloaded file
    const videoBuffer = await readFile(tempFilePath);
    videoBase64 = videoBuffer.toString("base64");
    
    // Clean up temp file
    await unlink(tempFilePath).catch(() => {
      // Ignore cleanup errors
    });
    
    return {
      video: `data:video/mp4;base64,${videoBase64}`,
      prompt: prompt,
    };
  } catch (downloadError: any) {
    console.error("Error downloading video file:", downloadError);
    
    // Clean up temp file if it exists
    await unlink(tempFilePath).catch(() => {
      // Ignore cleanup errors
    });
    
    // Fallback: try to fetch from URI if available
    const videoObj = generatedVideo.video as any;
    if (videoObj.uri) {
      try {
        const response = await fetch(videoObj.uri);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          videoBase64 = Buffer.from(arrayBuffer).toString("base64");
          
          return {
            video: `data:video/mp4;base64,${videoBase64}`,
            prompt: prompt,
          };
        }
      } catch (fetchError) {
        console.error("Error fetching video from URI:", fetchError);
      }
    }
    
    throw new Error("Video generated but download failed. Check console for details.");
  }
}

