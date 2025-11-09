import { NextRequest, NextResponse } from "next/server";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const brandContextSchema = z.object({
  companyName: z.string().min(1, "companyName is required"),
  productName: z.string().min(1, "productName is required"),
  briefPrompt: z.string().optional(),
});

const workflowInputSchema = z.object({
  videoBase64: z.string().min(1, "videoBase64 is required"),
  brandLogoBase64: z.string().min(1, "brandLogoBase64 is required"),
  productImageBase64: z.string().optional(),
  brandContext: brandContextSchema,
  originalPrompt: z.string().optional(),
});

const stepOutputSchema = z.object({
  report: z.record(z.any()),
  prompt: z.string(),
  warnings: z.array(z.string()).default([]),
});

const frameExtractionOutputSchema = z.object({
  frames: z.array(z.object({
    frame_number: z.number(),
    timestamp: z.number(),
    image_base64: z.string(),
  })),
  total_frames_extracted: z.number(),
  video_duration: z.number(),
  video_fps: z.number(),
  extraction_rate: z.number(),
  warnings: z.array(z.string()).default([]),
});

const logoDetectionDetectionSchema = z.object({
  frame_number: z.number(),
  timestamp: z.number(),
  method: z.string(),
  confidence: z.number(),
  bounding_box: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  crop_image_base64: z.string().nullable(),
  notes: z.string().nullable().optional(),
});

const logoDetectionOutputSchema = z.object({
  logo_found: z.boolean(),
  detections: z.array(logoDetectionDetectionSchema),
  primary_detection: logoDetectionDetectionSchema.nullable(),
  method_used: z.string().nullable(),
  warnings: z.array(z.string()).default([]),
  notes: z.string().nullable(),
});

const aggregationAfterParallelSchema = z.object({
  "overall-critic": stepOutputSchema,
  "visual-style": stepOutputSchema,
  "frame-extraction": frameExtractionOutputSchema,
  "audio-analysis": stepOutputSchema,
  brandContext: brandContextSchema,
  brandLogoBase64: z.string().min(1),
});

const aggregationAfterLogoDetectionSchema = aggregationAfterParallelSchema.extend({
  "logo-detection": logoDetectionOutputSchema,
  productImageBase64: z.string().optional(),
});

const colorPaletteSchema = z.object({
  dominant_colors: z.array(z.string()),
  secondary_colors: z.array(z.string()).default([]),
  color_count: z.number(),
});

const colorHarmonyOutputSchema = z.object({
  overall_score: z.number(),
  logo_colors: colorPaletteSchema.nullable(),
  frame_colors: colorPaletteSchema,
  brand_logo_colors: colorPaletteSchema,
  color_alignment_score: z.number(),
  analysis: z.string(),
  recommendations: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

const aggregationAfterColorHarmonySchema = aggregationAfterLogoDetectionSchema.extend({
  "color-harmony": colorHarmonyOutputSchema,
});

const synthesizerInputSchema = aggregationAfterColorHarmonySchema;

const backendBaseUrl =
  process.env.BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://127.0.0.1:8000";

const safetyEthicsStep = createStep({
  id: "safety-ethics",
  description: "Gemini safety and ethics agent",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/safety-ethics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute safety and ethics agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const messageClarityStep = createStep({
  id: "message-clarity",
  description: "Gemini message clarity agent",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/message-clarity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute message clarity agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const advisorInputSchema = z.object({
  "overall-critic": stepOutputSchema,
  "visual-style": stepOutputSchema,
  "frame-extraction": frameExtractionOutputSchema,
  "audio-analysis": stepOutputSchema,
  "logo-detection": logoDetectionOutputSchema,
  "color-harmony": colorHarmonyOutputSchema,
  "synthesizer": stepOutputSchema,
  "safety-ethics": stepOutputSchema,
  "message-clarity": stepOutputSchema,
  brandContext: brandContextSchema,
  brandLogoBase64: z.string().min(1),
  originalPrompt: z.string().optional(),
});

const advisorStep = createStep({
  id: "advisor",
  description: "AdVisor agent that aggregates all analysis results",
  inputSchema: advisorInputSchema,
  outputSchema: stepOutputSchema.extend({
    validationPrompt: z.string(),
  }),
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/advisor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brandAlignmentReport: inputData["overall-critic"]?.report ?? {},
        synthesizerReport: inputData["synthesizer"]?.report ?? {},
        safetyEthicsReport: inputData["safety-ethics"]?.report ?? {},
        messageClarityReport: inputData["message-clarity"]?.report ?? {},
        brandContext: inputData.brandContext,
        originalPrompt: inputData.originalPrompt,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute advisor agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      validationPrompt: payload.validationPrompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const overallCriticStep = createStep({
  id: "overall-critic",
  description: "Gemini overall critic agent",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/overall-critic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute overall critic agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const visualStyleStep = createStep({
  id: "visual-style",
  description: "Gemini visual style agent",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/visual-style`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        brandLogoBase64: inputData.brandLogoBase64,
        ...(inputData.productImageBase64 && { productImageBase64: inputData.productImageBase64 }),
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute visual style agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const frameExtractionStep = createStep({
  id: "frame-extraction",
  description: "Extract frames from video at 2 fps",
  inputSchema: workflowInputSchema,
  outputSchema: frameExtractionOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/frame-extraction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        framesPerSecond: 2.0,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute frame extraction agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    const normalizeNumber = (value: unknown, fallback: number): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return fallback;
    };

    const extractionRate = normalizeNumber(
      payload.extraction_rate ?? payload.extractionRate,
      2,
    );

    const frames = Array.isArray(payload.frames)
      ? payload.frames
          .map((frame: any, index: number) => {
            const frameNumber = normalizeNumber(
              frame?.frame_number ?? frame?.frameNumber,
              index,
            );

            const timestamp = normalizeNumber(
              frame?.timestamp ?? frame?.time,
              index / extractionRate,
            );

            const imageBase64 =
              typeof frame?.image_base64 === "string"
                ? frame.image_base64
                : typeof frame?.imageBase64 === "string"
                  ? frame.imageBase64
                  : typeof frame?.image === "string"
                    ? frame.image
                    : "";

            return {
              frame_number: frameNumber,
              timestamp,
              image_base64: imageBase64,
            };
          })
          .filter((frame: { image_base64: string }) => Boolean(frame.image_base64))
      : [];

    return {
      frames,
      total_frames_extracted: payload.total_frames_extracted ?? payload.totalFramesExtracted ?? 0,
      video_duration: payload.video_duration ?? payload.videoDuration ?? 0,
      video_fps: payload.video_fps ?? payload.videoFps ?? 0,
      extraction_rate: extractionRate,
      warnings: payload.warnings ?? [],
    };
  },
});

const logoDetectionStep = createStep({
  id: "logo-detection",
  description: "Detects and extracts brand logos from frames",
  inputSchema: aggregationAfterParallelSchema,
  outputSchema: logoDetectionOutputSchema,
  execute: async ({ inputData }) => {
    // Validate we have the data we need
    if (!inputData["frame-extraction"]?.frames || inputData["frame-extraction"].frames.length === 0) {
      throw new Error("No frames available from frame extraction step");
    }
    
    if (!inputData.brandLogoBase64) {
      throw new Error("Brand logo is missing");
    }
    
    if (!inputData.brandContext?.companyName || !inputData.brandContext?.productName) {
      throw new Error("Brand context is incomplete (missing companyName or productName)");
    }

    const framesPayload = inputData["frame-extraction"].frames.map((frame) => ({
      frameNumber: frame.frame_number,
      timestamp: frame.timestamp,
      imageBase64: frame.image_base64,
    }));

    const requestPayload = {
      frames: framesPayload,
      brandLogoBase64: inputData.brandLogoBase64,
      brandContext: inputData.brandContext,
      preferClip: true,
      useGeminiFallback: true,
    };

    console.log("Logo detection request payload:", JSON.stringify({
      framesCount: framesPayload.length,
      hasLogo: !!inputData.brandLogoBase64,
      brandContext: inputData.brandContext,
    }, null, 2));

    const response = await fetch(`${backendBaseUrl}/agents/logo-detection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let message = "Failed to execute logo detection agent";
      try {
        const errorPayload = await response.json();
        console.error("Logo detection error payload:", errorPayload);
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      console.error("Logo detection failed with status:", response.status, message);
      throw new Error(message);
    }

    const payload = await response.json();

    const normalizeDetection = (detection: any) => ({
      frame_number: detection.frame_number ?? detection.frameNumber ?? 0,
      timestamp: detection.timestamp ?? 0,
      method: detection.method ?? "",
      confidence: detection.confidence ?? 0,
      bounding_box:
        detection.bounding_box ??
        detection.boundingBox ??
        null,
      crop_image_base64:
        detection.crop_image_base64 ??
        detection.cropImageBase64 ??
        null,
      notes: detection.notes ?? null,
    });

    const primaryRaw =
      payload.primary_detection ??
      payload.primaryDetection ??
      null;

    const normalized = {
      logo_found: payload.logo_found ?? payload.logoFound ?? false,
      detections: Array.isArray(payload.detections)
        ? payload.detections.map(normalizeDetection)
        : [],
      primary_detection: primaryRaw ? normalizeDetection(primaryRaw) : null,
      method_used: payload.method_used ?? payload.methodUsed ?? null,
      warnings: payload.warnings ?? [],
      notes: payload.notes ?? null,
    };

    return normalized;
  },
});

const colorHarmonyStep = createStep({
  id: "color-harmony",
  description: "Analyzes color palettes and compares with brand assets",
  inputSchema: aggregationAfterLogoDetectionSchema,
  outputSchema: colorHarmonyOutputSchema,
  execute: async ({ inputData }) => {
    // Prepare frames payload
    const framesPayload = inputData["frame-extraction"].frames.map((frame) => ({
      frameNumber: frame.frame_number,
      timestamp: frame.timestamp,
      imageBase64: frame.image_base64,
    }));

    // Prepare logo detections payload
    const logoDetectionsPayload = inputData["logo-detection"]?.detections?.map((det: any) => ({
      frameNumber: det.frame_number ?? det.frameNumber ?? 0,
      timestamp: det.timestamp ?? 0,
      method: det.method ?? "",
      confidence: det.confidence ?? 0,
      boundingBox: det.bounding_box ?? det.boundingBox ?? null,
      cropImageBase64: det.crop_image_base64 ?? det.cropImageBase64 ?? null,
      notes: det.notes ?? null,
    })) ?? [];

    const requestPayload = {
      frames: framesPayload,
      logoDetections: logoDetectionsPayload,
      brandLogoBase64: inputData.brandLogoBase64,
      productImageBase64: inputData.productImageBase64 || null,
      brandContext: inputData.brandContext,
    };

    const response = await fetch(`${backendBaseUrl}/agents/color-harmony`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let message = "Failed to execute color harmony agent";
      try {
        const errorPayload = await response.json();
        console.error("Color harmony error payload:", errorPayload);
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      overall_score: payload.overall_score ?? payload.overallScore ?? 0,
      logo_colors: payload.logo_colors ?? payload.logoColors ?? null,
      frame_colors: payload.frame_colors ?? payload.frameColors ?? {
        dominant_colors: [],
        secondary_colors: [],
        color_count: 0,
      },
      brand_logo_colors: payload.brand_logo_colors ?? payload.brandLogoColors ?? {
        dominant_colors: [],
        secondary_colors: [],
        color_count: 0,
      },
      color_alignment_score: payload.color_alignment_score ?? payload.colorAlignmentScore ?? 0,
      analysis: payload.analysis ?? "",
      recommendations: payload.recommendations ?? [],
      warnings: payload.warnings ?? [],
    };
  },
});

const synthesizerStep = createStep({
  id: "synthesizer",
  description: "Aggregates agent feedback into a unified critique",
  inputSchema: synthesizerInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/synthesizer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        overallReport: inputData["overall-critic"].report,
        visualReport: inputData["visual-style"].report,
        audioReport: inputData["audio-analysis"]?.report,
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute synthesizer agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const audioAnalysisStep = createStep({
  id: "audio-analysis",
  description: "Gemini audio analysis agent",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
  execute: async ({ inputData }) => {
    const response = await fetch(`${backendBaseUrl}/agents/audio-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoBase64: inputData.videoBase64,
        brandContext: inputData.brandContext,
      }),
    });

    if (!response.ok) {
      let message = "Failed to execute audio analysis agent";
      try {
        const errorPayload = await response.json();
        message =
          errorPayload?.detail ??
          errorPayload?.error ??
          response.statusText ??
          message;
      } catch (error) {
        console.error("Failed to parse agent error payload", error);
      }
      throw new Error(message);
    }

    const payload = await response.json();

    return {
      report: payload.report ?? payload,
      prompt: payload.prompt ?? "",
      warnings: payload.warnings ?? [],
    };
  },
});

const brandAlignmentWorkflow = createWorkflow({
  id: "brand-alignment",
  description: "Brand alignment critique workflow",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema.extend({
    validationPrompt: z.string().optional(),
  }),
})
  .parallel([
    overallCriticStep,
    visualStyleStep,
    frameExtractionStep,
    audioAnalysisStep,
    safetyEthicsStep,
    messageClarityStep,
  ])
  .map(async ({ getStepResult, getInitData }) => {
    const overallCriticResult = await getStepResult("overall-critic");
    const visualStyleResult = await getStepResult("visual-style");
    const frameExtractionResult = await getStepResult("frame-extraction");
    const audioAnalysisResult = await getStepResult("audio-analysis");
    const safetyEthicsResult = await getStepResult("safety-ethics");
    const messageClarityResult = await getStepResult("message-clarity");
    const initialData = getInitData();

    return {
      "overall-critic": overallCriticResult,
      "visual-style": visualStyleResult,
      "frame-extraction": frameExtractionResult,
      "audio-analysis": audioAnalysisResult,
      "safety-ethics": safetyEthicsResult,
      "message-clarity": messageClarityResult,
      brandContext: initialData.brandContext,
      brandLogoBase64: initialData.brandLogoBase64,
    };
  })
  .then(logoDetectionStep)
  .map(async ({ getStepResult, getInitData }) => {
    const [
      overallCriticResult,
      visualStyleResult,
      frameExtractionResult,
      audioAnalysisResult,
      safetyEthicsResult,
      messageClarityResult,
      logoDetectionResult,
    ] = await Promise.all([
      getStepResult("overall-critic"),
      getStepResult("visual-style"),
      getStepResult("frame-extraction"),
      getStepResult("audio-analysis"),
      getStepResult("safety-ethics"),
      getStepResult("message-clarity"),
      getStepResult("logo-detection"),
    ]);

    const initialData = getInitData();

    return {
      "overall-critic": overallCriticResult,
      "visual-style": visualStyleResult,
      "frame-extraction": frameExtractionResult,
      "audio-analysis": audioAnalysisResult,
      "safety-ethics": safetyEthicsResult,
      "message-clarity": messageClarityResult,
      "logo-detection": logoDetectionResult,
      brandContext: initialData.brandContext,
      brandLogoBase64: initialData.brandLogoBase64,
      productImageBase64: initialData.productImageBase64,
    };
  })
  .then(colorHarmonyStep)
  .map(async ({ getStepResult, getInitData }) => {
    const [
      overallCriticResult,
      visualStyleResult,
      frameExtractionResult,
      audioAnalysisResult,
      safetyEthicsResult,
      messageClarityResult,
      logoDetectionResult,
      colorHarmonyResult,
    ] = await Promise.all([
      getStepResult("overall-critic"),
      getStepResult("visual-style"),
      getStepResult("frame-extraction"),
      getStepResult("audio-analysis"),
      getStepResult("safety-ethics"),
      getStepResult("message-clarity"),
      getStepResult("logo-detection"),
      getStepResult("color-harmony"),
    ]);

    const initialData = getInitData();

    return {
      "overall-critic": overallCriticResult,
      "visual-style": visualStyleResult,
      "frame-extraction": frameExtractionResult,
      "audio-analysis": audioAnalysisResult,
      "safety-ethics": safetyEthicsResult,
      "message-clarity": messageClarityResult,
      "logo-detection": logoDetectionResult,
      "color-harmony": colorHarmonyResult,
      brandContext: initialData.brandContext,
      brandLogoBase64: initialData.brandLogoBase64,
    };
  })
  .then(synthesizerStep)
  .map(async ({ getStepResult, getInitData }) => {
    const [
      overallCriticResult,
      visualStyleResult,
      frameExtractionResult,
      audioAnalysisResult,
      safetyEthicsResult,
      messageClarityResult,
      logoDetectionResult,
      colorHarmonyResult,
      synthesizerResult,
    ] = await Promise.all([
      getStepResult("overall-critic"),
      getStepResult("visual-style"),
      getStepResult("frame-extraction"),
      getStepResult("audio-analysis"),
      getStepResult("safety-ethics"),
      getStepResult("message-clarity"),
      getStepResult("logo-detection"),
      getStepResult("color-harmony"),
      getStepResult("synthesizer"),
    ]);

    const initialData = getInitData();

    return {
      "overall-critic": overallCriticResult,
      "visual-style": visualStyleResult,
      "frame-extraction": frameExtractionResult,
      "audio-analysis": audioAnalysisResult,
      "safety-ethics": safetyEthicsResult,
      "message-clarity": messageClarityResult,
      "logo-detection": logoDetectionResult,
      "color-harmony": colorHarmonyResult,
      "synthesizer": synthesizerResult,
      brandContext: initialData.brandContext,
      brandLogoBase64: initialData.brandLogoBase64,
      originalPrompt: initialData.originalPrompt,
    };
  })
  .then(advisorStep)
  .commit();

// Helper to format step data
function formatStep(
  id: string,
  step: any,
  validationData: any
): any {
  const startedAt =
    "startedAt" in step && typeof step.startedAt === "number"
      ? new Date(step.startedAt).toISOString()
      : null;
  const endedAt =
    "endedAt" in step && typeof step.endedAt === "number"
      ? new Date(step.endedAt).toISOString()
      : null;

  // Ensure payload is always an object, use inputData if payload is missing
  let payload = step.payload;
  if (
    !payload &&
    (id === "overall-critic" ||
      id === "visual-style" ||
      id === "frame-extraction" ||
      id === "logo-detection" ||
      id === "safety-ethics" ||
      id === "message-clarity")
  ) {
    payload = validationData;
  }
  if (
    !payload &&
    id === "synthesizer" &&
    validationData
  ) {
    payload = {
      brandContext: validationData.brandContext,
      combinedFrom: ["overall-critic", "visual-style", "logo-detection"],
    };
  }
  if (
    !payload &&
    id === "advisor" &&
    validationData
  ) {
    payload = {
      brandContext: validationData.brandContext,
      combinedFrom: ["synthesizer", "safety-ethics", "message-clarity"],
    };
  }

  return {
    id,
    status: step.status,
    startedAt,
    endedAt,
    payload: payload || null,
    output: "output" in step ? step.output : null,
    warnings:
      step.status === "success" && step.output?.warnings
        ? step.output.warnings
        : [],
    metadata: step.metadata ?? null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const useStreaming = body.stream === true;

  const validation = workflowInputSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: validation.error.flatten(),
      },
      { status: 400 }
    );
  }

  // Check if client wants streaming
  if (useStreaming) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendStep = (stepData: any) => {
          const data = JSON.stringify({ type: "step", data: stepData }) + "\n\n";
          controller.enqueue(encoder.encode(`data: ${data}`));
        };

        const sendComplete = (finalData: any) => {
          const data = JSON.stringify({ type: "complete", data: finalData }) + "\n\n";
          controller.enqueue(encoder.encode(`data: ${data}`));
          controller.close();
        };

        try {
          // Send input step immediately
          sendStep({
            id: "input",
            status: "success",
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            payload: validation.data,
            output: null,
            warnings: [],
            metadata: null,
          });

          const run = await brandAlignmentWorkflow.createRunAsync();
          
          // Start workflow execution
          // Note: Mastra workflows execute synchronously, so we can't get true
          // incremental updates. However, we can at least send the final result
          // immediately when it's ready.
          const execution = await run.start({ inputData: validation.data });

          if (execution.status !== "success") {
            const errorData = JSON.stringify({
              type: "error",
              data: {
                error: "Workflow failed to execute",
                status: execution.status,
                details: execution,
              },
            }) + "\n\n";
            controller.enqueue(encoder.encode(`data: ${errorData}`));
            controller.close();
            return;
          }

          // Send all steps as they become available
          const steps = Object.entries(execution.steps)
            .filter(([id]) => !id.startsWith("map"))
            .map(([id, step]) => formatStep(id, step, validation.data));

          // Send steps one by one (simulating incremental updates)
          for (const step of steps) {
            sendStep(step);
            // Small delay to make updates visible
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Send final result
          sendComplete({
            status: execution.status,
            result: execution.result,
            steps: [
              {
                id: "input",
                status: "success" as const,
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                payload: validation.data,
                output: null,
                warnings: [],
                metadata: null,
              },
              ...steps,
            ],
          });
        } catch (error) {
          const errorData = JSON.stringify({
            type: "error",
            data: {
              error: "Workflow execution error",
              details: error instanceof Error ? error.message : String(error),
            },
          }) + "\n\n";
          controller.enqueue(encoder.encode(`data: ${errorData}`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming (original behavior)
  const run = await brandAlignmentWorkflow.createRunAsync();
  const execution = await run.start({ inputData: validation.data });

  if (execution.status !== "success") {
    return NextResponse.json(
      {
        error: "Workflow failed to execute",
        status: execution.status,
        details: execution,
      },
      { status: 500 }
    );
  }

  // Add input step
  const steps = [
    {
      id: "input",
      status: "success" as const,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      payload: validation.data,
      output: null,
      warnings: [],
      metadata: null,
    },
    ...Object.entries(execution.steps)
      .filter(([id]) => !id.startsWith("map"))
      .map(([id, step]) => formatStep(id, step, validation.data)),
  ];

  return NextResponse.json({
    status: execution.status,
    result: execution.result,
    steps,
  });
}


