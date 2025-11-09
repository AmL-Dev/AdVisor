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
  productImageBase64: z.string().min(1, "productImageBase64 is required"),
  brandContext: brandContextSchema,
});

const stepOutputSchema = z.object({
  report: z.record(z.any()),
  prompt: z.string(),
  model: z.string(),
  warnings: z.array(z.string()).default([]),
  rawText: z.string().nullable().optional(),
});

const backendBaseUrl =
  process.env.BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://127.0.0.1:8000";

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
      model: payload.model ?? "gemini-2.0-flash-exp",
      warnings: payload.warnings ?? [],
      rawText: payload.rawText ?? null,
    };
  },
});

const brandAlignmentWorkflow = createWorkflow({
  id: "brand-alignment",
  description: "Brand alignment critique workflow",
  inputSchema: workflowInputSchema,
  outputSchema: stepOutputSchema,
})
  .then(overallCriticStep)
  .commit();

export async function POST(request: NextRequest) {
  const body = await request.json();

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

  const steps = Object.entries(execution.steps).map(([id, step]) => {
    const startedAt =
      "startedAt" in step && typeof step.startedAt === "number"
        ? new Date(step.startedAt).toISOString()
        : null;
    const endedAt =
      "endedAt" in step && typeof step.endedAt === "number"
        ? new Date(step.endedAt).toISOString()
        : null;

    // Ensure payload is always an object, use inputData for first step if payload is missing
    let payload = step.payload;
    if (!payload && id === "overall-critic") {
      // For the first step, use the workflow input data as payload
      payload = validation.data;
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
  });

  return NextResponse.json({
    status: execution.status,
    result: execution.result,
    steps,
  });
}


