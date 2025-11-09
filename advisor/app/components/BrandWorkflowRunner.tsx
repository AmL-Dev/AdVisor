"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import WorkflowGraph from "./WorkflowGraph";

type BrandContext = {
  companyName: string;
  productName: string;
  briefPrompt?: string;
};

type ReportStepOutput = {
  report: Record<string, unknown>;
  prompt: string;
  model?: string;
  warnings: string[];
  rawText?: string | null;
};

type FrameExtractionStepOutput = {
  frames: {
    frame_number: number;
    timestamp: number;
    image_base64: string;
  }[];
  total_frames_extracted: number;
  video_duration: number;
  video_fps: number;
  extraction_rate: number;
  warnings: string[];
};

type LogoDetectionBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LogoDetectionDetection = {
  frame_number: number;
  timestamp: number;
  method: string;
  confidence: number;
  bounding_box: LogoDetectionBoundingBox | null;
  crop_image_base64: string | null;
  notes?: string | null;
};

type LogoDetectionStepOutput = {
  logo_found: boolean;
  detections: LogoDetectionDetection[];
  primary_detection: LogoDetectionDetection | null;
  method_used: string | null;
  warnings: string[];
  notes?: string | null;
};

type ColorPaletteOutput = {
  dominant_colors: string[];
  secondary_colors: string[];
  color_count: number;
};

type ColorHarmonyStepOutput = {
  overall_score: number;
  logo_colors: ColorPaletteOutput | null;
  frame_colors: ColorPaletteOutput;
  brand_logo_colors: ColorPaletteOutput;
  color_alignment_score: number;
  analysis: string;
  recommendations: string[];
  warnings: string[];
};

type StepOutput =
  | ReportStepOutput
  | FrameExtractionStepOutput
  | LogoDetectionStepOutput
  | ColorHarmonyStepOutput;

function isReportOutput(output: StepOutput): output is ReportStepOutput {
  return "report" in output;
}

function isFrameExtractionOutput(output: StepOutput): output is FrameExtractionStepOutput {
  return "frames" in output;
}

function isLogoDetectionOutput(output: StepOutput): output is LogoDetectionStepOutput {
  return "logo_found" in output;
}

function isColorHarmonyOutput(output: StepOutput): output is ColorHarmonyStepOutput {
  return "color_alignment_score" in output;
}

type WorkflowStep = {
  id: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  payload?: {
    videoBase64?: string;
    brandLogoBase64?: string;
    productImageBase64?: string;
    brandContext?: BrandContext;
  };
  output: StepOutput | null;
  warnings: string[];
  metadata?: Record<string, unknown> | null;
};

type WorkflowResponse = {
  status: string;
  result: ReportStepOutput;
  steps: WorkflowStep[];
};

type MediaDescriptor = {
  type: "video" | "image";
  data?: string;
  label: string;
};

const STEP_LABELS: Record<string, string> = {
  "overall-critic": "Overall Critic Agent",
  "visual-style": "Visual Style Agent",
  "frame-extraction": "Frame Extraction",
  "logo-detection": "Logo Detection Agent",
  "color-harmony": "Color Harmony Agent",
  synthesizer: "Brand Synthesizer",
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BrandWorkflowRunner() {
  const searchParams = useSearchParams();
  const [companyName, setCompanyName] = useState("");
  const [productName, setProductName] = useState("");
  const [briefPrompt, setBriefPrompt] = useState("");
  const [videoBase64, setVideoBase64] = useState<string>("");
  const [brandLogoBase64, setBrandLogoBase64] = useState<string>("");
  const [productImageBase64, setProductImageBase64] = useState<string>("");
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [productPreview, setProductPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResponse | null>(
    null,
  );
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [expandedMedia, setExpandedMedia] = useState<MediaDescriptor | null>(
    null,
  );

  const createPlaceholderSteps = (): WorkflowStep[] => {
    const brandContextPayload: BrandContext = {
      companyName,
      productName,
      briefPrompt: briefPrompt || undefined,
    };

    const sharedPayload = {
      videoBase64,
      brandLogoBase64,
      ...(productImageBase64 && { productImageBase64 }),
      brandContext: brandContextPayload,
    };

    const nowIso = new Date().toISOString();

    return [
      {
        id: "input",
        status: "success",
        startedAt: nowIso,
        endedAt: nowIso,
        payload: sharedPayload,
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "overall-critic",
        status: loading ? "running" : "pending",
        startedAt: null,
        endedAt: null,
        payload: sharedPayload,
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "visual-style",
        status: loading ? "running" : "pending",
        startedAt: null,
        endedAt: null,
        payload: sharedPayload,
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "frame-extraction",
        status: loading ? "running" : "pending",
        startedAt: null,
        endedAt: null,
        payload: sharedPayload,
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "logo-detection",
        status: "pending",
        startedAt: null,
        endedAt: null,
        payload: {
          brandLogoBase64,
          brandContext: brandContextPayload,
        },
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "color-harmony",
        status: "pending",
        startedAt: null,
        endedAt: null,
        payload: {
          brandLogoBase64,
          brandContext: brandContextPayload,
        },
        output: null,
        warnings: [],
        metadata: null,
      },
      {
        id: "synthesizer",
        status: "pending",
        startedAt: null,
        endedAt: null,
        payload: {
          brandContext: brandContextPayload,
          combinedFrom: ["overall-critic", "visual-style", "logo-detection"],
        },
        output: null,
        warnings: [],
        metadata: null,
      },
    ];
  };

  // Load data from URL parameters if present (e.g., when coming from ad generator)
  useEffect(() => {
    const videoParam = searchParams.get("video");
    const companyParam = searchParams.get("companyName");
    const productParam = searchParams.get("productName");
    const logoParam = searchParams.get("logo");
    const productImgParam = searchParams.get("product");

    if (videoParam) {
      setVideoBase64(videoParam);
      setVideoPreview(videoParam);
    }
    if (companyParam) {
      setCompanyName(decodeURIComponent(companyParam));
    }
    if (productParam) {
      setProductName(decodeURIComponent(productParam));
    }
    if (logoParam) {
      setBrandLogoBase64(logoParam);
      setLogoPreview(logoParam);
    }
    if (productImgParam) {
      setProductImageBase64(productImgParam);
      setProductPreview(productImgParam);
    }
  }, [searchParams]);

  const canSubmit = useMemo(() => {
    return (
      companyName.trim().length > 0 &&
      productName.trim().length > 0 &&
      videoBase64 &&
      brandLogoBase64
    );
  }, [companyName, productName, videoBase64, brandLogoBase64]);

  const handleFileUpload =
    (type: "video" | "brandLogo" | "productImage") =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (type === "video" && !file.type.startsWith("video/")) {
        setError("Please upload a valid video file (mp4, webm, mov...).");
        return;
      }

      if (type !== "video" && !file.type.startsWith("image/")) {
        setError("Please upload a valid image file (png, jpg, webp...).");
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        setError(null);

        if (type === "video") {
          setVideoBase64(dataUrl);
          setVideoPreview(dataUrl);
        } else if (type === "brandLogo") {
          setBrandLogoBase64(dataUrl);
          setLogoPreview(dataUrl);
        } else if (type === "productImage") {
          setProductImageBase64(dataUrl);
          setProductPreview(dataUrl);
        }
      } catch (uploadError) {
        console.error("Failed to read file", uploadError);
        setError("Failed to read the selected file. Please try again.");
      }
    };

  const resetForm = () => {
    setCompanyName("");
    setProductName("");
    setBriefPrompt("");
    setVideoBase64("");
    setBrandLogoBase64("");
    setProductImageBase64("");
    setVideoPreview("");
    setLogoPreview("");
    setProductPreview("");
    setWorkflowResult(null);
    setExpandedStepId(null);
    setExpandedMedia(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setError("Please provide all required fields before running the workflow.");
      return;
    }

    setLoading(true);
    setError(null);
    setWorkflowResult(null);

    try {
      // Use streaming to get intermediate updates
      const response = await fetch("/api/workflows/brand-alignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoBase64,
          brandLogoBase64,
          ...(productImageBase64 && { productImageBase64 }),
          brandContext: {
            companyName,
            productName,
            briefPrompt: briefPrompt || undefined,
          },
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.error ??
          payload?.detail ??
          payload?.message ??
          "Workflow execution failed";
        throw new Error(message);
      }

      // Check if response is streaming (SSE)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("text/event-stream")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error("Streaming response body is not available");
        }

        // Initialize with all steps (using placeholder steps to show full workflow)
        const initialSteps = createPlaceholderSteps();
        // Update input step to success
        const inputStepIndex = initialSteps.findIndex((s) => s.id === "input");
        if (inputStepIndex >= 0) {
          initialSteps[inputStepIndex] = {
            ...initialSteps[inputStepIndex],
            status: "success",
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
          };
        }
        // Update parallel steps to running
        ["overall-critic", "visual-style", "frame-extraction"].forEach((id) => {
          const stepIndex = initialSteps.findIndex((s) => s.id === id);
          if (stepIndex >= 0) {
            initialSteps[stepIndex] = {
              ...initialSteps[stepIndex],
              status: "running",
            };
          }
        });

        setWorkflowResult({
          status: "running",
          result: null,
          steps: initialSteps,
        });

        let buffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6); // Remove "data: " prefix
                const event = JSON.parse(jsonStr);

                if (event.type === "step") {
                  // Update step in workflow result
                  setWorkflowResult((prev) => {
                    if (!prev) return prev;
                    const existingIndex = prev.steps.findIndex((s) => s.id === event.data.id);
                    const updatedSteps = [...prev.steps];
                    
                    if (existingIndex >= 0) {
                      updatedSteps[existingIndex] = event.data;
                    } else {
                      updatedSteps.push(event.data);
                    }

                    return {
                      ...prev,
                      steps: updatedSteps,
                    };
                  });
                } else if (event.type === "complete") {
                  // Final result
                  setWorkflowResult(event.data as WorkflowResponse);
                  const synthesizerStepId =
                    event.data.steps.find((step) => step.id === "synthesizer")?.id ??
                    event.data.steps[0]?.id ??
                    null;
                  setExpandedStepId(synthesizerStepId);
                  setLoading(false);
                  return;
                } else if (event.type === "error") {
                  throw new Error(event.data.error || "Workflow execution error");
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE event:", parseError);
              }
            }
          }
        }
      } else {
        // Non-streaming response (fallback)
        const data = (await response.json()) as WorkflowResponse;
        setWorkflowResult(data);
        const synthesizerStepId =
          data.steps.find((step) => step.id === "synthesizer")?.id ??
          data.steps[0]?.id ??
          null;
        setExpandedStepId(synthesizerStepId);
      }
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unexpected error while running the workflow.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMediaPreview = (descriptor: MediaDescriptor) => {
    if (!descriptor.data) {
      return null;
    }

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {descriptor.label}
          </span>
          <button
            type="button"
            onClick={() => setExpandedMedia(descriptor)}
            className="text-xs font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
          >
            Expand
          </button>
        </div>
        {descriptor.type === "video" ? (
          <video
            src={descriptor.data}
            controls
            className="h-40 w-full rounded-lg object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={descriptor.data}
            alt={descriptor.label}
            className="h-40 w-full rounded-lg object-contain bg-zinc-50 dark:bg-zinc-800"
          />
        )}
      </div>
    );
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return "—";
    }
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <header className="mb-6 space-y-2 text-center sm:text-left">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Brand Alignment Workflow
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload a generated ad with supporting assets to run the Mastra-powered
            workflow and receive structured brand critique insights.
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="companyName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/40"
                placeholder="e.g., Nike"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="productName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                id="productName"
                type="text"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/40"
                placeholder="e.g., Air Zoom Pegasus"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="briefPrompt"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Brief / Creative Direction
            </label>
            <textarea
              id="briefPrompt"
              value={briefPrompt}
              onChange={(event) => setBriefPrompt(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-400/40"
              placeholder="Describe the creative intent behind this ad..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <UploaderCard
              id="videoUpload"
              label="Generated Video"
              required
              accept="video/*"
              preview={videoPreview}
              placeholder="Upload ad video"
              onChange={handleFileUpload("video")}
              type="video"
            />
            <UploaderCard
              id="brandLogoUpload"
              label="Brand Logo"
              required
              accept="image/*"
              preview={logoPreview}
              placeholder="Upload logo"
              onChange={handleFileUpload("brandLogo")}
            />
            <UploaderCard
              id="productImageUpload"
              label="Product Image"
              accept="image/*"
              preview={productPreview}
              placeholder="Upload product"
              onChange={handleFileUpload("productImage")}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Running workflow…" : "Run Brand Alignment Workflow"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {(workflowResult || loading) && (
        <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          <header className="space-y-1">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Workflow Execution
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Visual workflow graph showing agent execution. Click on nodes to view
              detailed inputs and outputs. Use controls to zoom and pan.
            </p>
          </header>

          {/* Workflow Graph View */}
          <div className="w-full">
            <WorkflowGraph
              steps={
                workflowResult?.steps || createPlaceholderSteps()
              }
              onNodeClick={(stepId) => {
                // Allow clicking nodes even while loading to see current state
                setExpandedStepId(stepId);
              }}
              selectedNodeId={expandedStepId}
            />
          </div>

          {/* Detailed Step View (shown when node is clicked) */}
          {expandedStepId && (workflowResult || loading) && (
            <div className="mt-6 space-y-4">
              {(() => {
                // Find the step with the matching ID (use current steps or loading state)
                const currentSteps = workflowResult?.steps || createPlaceholderSteps();
                
                const step = currentSteps.find((s) => s.id === expandedStepId);
                if (!step) return null;
                
                const payload = step.payload || {};
                const media: MediaDescriptor[] = [
                  {
                    type: "video",
                    data: payload.videoBase64,
                    label: "Input Video",
                  },
                  {
                    type: "image",
                    data: payload.brandLogoBase64,
                    label: "Brand Logo",
                  },
                  {
                    type: "image",
                    data: payload.productImageBase64,
                    label: "Product Image",
                  },
                ];

                return (
                  <div
                    key={step.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/60 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                      <div className="space-y-6 border-t border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {STEP_LABELS[step.id] ?? step.id} - Details
                            </h4>
                            {step.status === "running" && (
                              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-2">
                                <span className="animate-spin">⟳</span> Currently running...
                              </p>
                            )}
                            {step.status === "pending" && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Waiting to start...
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedStepId(null)}
                            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <div className="space-y-4">
                            <h5 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              Inputs
                            </h5>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {media.map((descriptor) => (
                                <div key={descriptor.label}>
                                  {renderMediaPreview(descriptor)}
                                </div>
                              ))}
                            </div>
                            {payload.brandContext && (
                              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
                                <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                  Brand Context
                                </p>
                                <ul className="mt-2 space-y-1">
                                  <li>
                                    <strong>Company:</strong>{" "}
                                    {payload.brandContext.companyName}
                                  </li>
                                  <li>
                                    <strong>Product:</strong>{" "}
                                    {payload.brandContext.productName}
                                  </li>
                                  {payload.brandContext.briefPrompt && (
                                    <li>
                                      <strong>Brief:</strong>{" "}
                                      {payload.brandContext.briefPrompt}
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              Output
                            </h5>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                              {step.output ? (
                                <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
                                  {step.output.warnings?.length > 0 && (
                                    <div>
                                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                        Warnings
                                      </p>
                                      <ul className="mt-1 list-disc space-y-1 pl-4">
                                        {step.output.warnings.map((warning, index) => (
                                          <li key={index}>{warning}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {isReportOutput(step.output) && (
                                    <div className="space-y-2">
                                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                        Report
                                      </p>
                                      <pre className="max-h-96 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
                                        {JSON.stringify(step.output.report, null, 2)}
                                      </pre>
                                      {step.output.prompt && (
                                        <div>
                                          <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Prompt
                                          </p>
                                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">
                                            {step.output.prompt}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                                  )}
                                  {isFrameExtractionOutput(step.output) && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Frames Extracted:
                                          </span>{" "}
                                          {step.output.total_frames_extracted}
                            </div>
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Extraction Rate:
                                          </span>{" "}
                                          {step.output.extraction_rate.toFixed(2)} fps
                          </div>
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Video Duration:
                                          </span>{" "}
                                          {step.output.video_duration.toFixed(2)}s
                        </div>
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Native FPS:
                                          </span>{" "}
                                          {step.output.video_fps.toFixed(2)}
                      </div>
                    </div>
                                      {step.output.frames.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                          {step.output.frames.slice(0, 8).map((frame) => (
                                            <figure
                                              key={`${frame.frame_number}-${frame.timestamp}`}
                                              className="space-y-2"
                                            >
                                              <img
                                                src={frame.image_base64}
                                                alt={`Frame ${frame.frame_number} at ${frame.timestamp}s`}
                                                className="h-32 w-full rounded-lg object-cover"
                                              />
                                              <figcaption className="text-xs text-zinc-500 dark:text-zinc-400">
                                                Frame {frame.frame_number} · {frame.timestamp}s
                                              </figcaption>
                                            </figure>
                            ))}
                          </div>
                                      ) : (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                          No frames were extracted.
                                        </p>
                                      )}
                                      {step.output.frames.length > 8 && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                          Showing first 8 of {step.output.frames.length} frames.
                                        </p>
                                      )}
                                  </div>
                                )}
                                  {isLogoDetectionOutput(step.output) && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Logo Found:
                                          </span>{" "}
                                          {step.output.logo_found ? "Yes" : "No"}
                                        </div>
                                        {step.output.method_used && (
                                          <div>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                              Method:
                                            </span>{" "}
                                            {step.output.method_used}
                                          </div>
                                        )}
                                        {step.output.notes && (
                                          <div className="sm:col-span-2">
                                            <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                              Notes:
                                            </span>{" "}
                                            {step.output.notes}
                                          </div>
                                        )}
                                      </div>
                                      {step.output.detections.length > 0 ? (
                                        <div className="space-y-4">
                                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Showing up to the first 6 detections.
                                          </div>
                                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {step.output.detections.slice(0, 6).map((detection) => {
                                              const confidencePct = Math.round(
                                                Math.max(0, Math.min(1, detection.confidence)) * 100,
                                              );
                                              return (
                                              <div
                                                key={`${detection.frame_number}-${detection.timestamp}-${detection.method}`}
                                                className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70"
                                              >
                                                {detection.crop_image_base64 ? (
                                                  <img
                                                    src={detection.crop_image_base64}
                                                    alt={`Logo detection frame ${detection.frame_number}`}
                                                    className="mb-3 h-32 w-full rounded-md object-cover"
                                                  />
                                                ) : (
                                                  <div className="mb-3 flex h-32 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                                                    No crop available
                                                  </div>
                                                )}
                                                <dl className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                                                  <div className="flex justify-between">
                                                    <dt className="font-medium">Frame</dt>
                                                    <dd>{detection.frame_number}</dd>
                                                  </div>
                                                  <div className="flex justify-between">
                                                    <dt className="font-medium">Timestamp</dt>
                                                    <dd>{detection.timestamp}s</dd>
                                                  </div>
                                                  <div className="flex justify-between">
                                                    <dt className="font-medium">Method</dt>
                                                    <dd>{detection.method}</dd>
                                                  </div>
                                                  <div className="flex justify-between">
                                                    <dt className="font-medium">Confidence</dt>
                                                    <dd>{confidencePct}%</dd>
                                                  </div>
                                                  {detection.bounding_box && (
                                                    <div>
                                                      <dt className="font-medium">Bounding Box</dt>
                                                      <dd>
                                                        x:{detection.bounding_box.x.toFixed(2)}, y:
                                                        {detection.bounding_box.y.toFixed(2)}, w:
                                                        {detection.bounding_box.width.toFixed(2)}, h:
                                                        {detection.bounding_box.height.toFixed(2)}
                                                      </dd>
                                                    </div>
                                                  )}
                                                  {detection.notes && (
                                                    <div>
                                                      <dt className="font-medium">Notes</dt>
                                                      <dd>{detection.notes}</dd>
                                                    </div>
                                                  )}
                                                </dl>
                                              </div>
                                              );
                                            })}
                                          </div>
                                          {step.output.detections.length > 6 && (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                              {step.output.detections.length - 6} additional detections not shown.
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                          No logo detections were returned.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {isColorHarmonyOutput(step.output) && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Overall Score:
                                          </span>{" "}
                                          {(step.output.overall_score * 100).toFixed(1)}%
                                        </div>
                                        <div>
                                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                            Color Alignment:
                                          </span>{" "}
                                          {(step.output.color_alignment_score * 100).toFixed(1)}%
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        {step.output.brand_logo_colors?.dominant_colors && (
                                          <div>
                                            <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                              Brand Logo Colors
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {step.output.brand_logo_colors.dominant_colors.map((color, idx) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
                                                >
                                                  <div
                                                    className="h-6 w-6 rounded"
                                                    style={{ backgroundColor: color }}
                                                  />
                                                  <span className="text-xs font-mono">{color}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {step.output.logo_colors?.dominant_colors && step.output.logo_colors.dominant_colors.length > 0 && (
                                          <div>
                                            <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                              Detected Logo Colors
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {step.output.logo_colors.dominant_colors.map((color, idx) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
                                                >
                                                  <div
                                                    className="h-6 w-6 rounded"
                                                    style={{ backgroundColor: color }}
                                                  />
                                                  <span className="text-xs font-mono">{color}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {step.output.frame_colors?.dominant_colors && step.output.frame_colors.dominant_colors.length > 0 && (
                                          <div>
                                            <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                              Frame Colors
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                              {step.output.frame_colors.dominant_colors.map((color, idx) => (
                                                <div
                                                  key={idx}
                                                  className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
                                                >
                                                  <div
                                                    className="h-6 w-6 rounded"
                                                    style={{ backgroundColor: color }}
                                                  />
                                                  <span className="text-xs font-mono">{color}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div>
                                        <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                          Analysis
                                        </p>
                                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                          {step.output.analysis}
                                        </p>
                                      </div>
                                      
                                      {step.output.recommendations.length > 0 && (
                                        <div>
                                          <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                            Recommendations
                                          </p>
                                          <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
                                            {step.output.recommendations.map((rec, idx) => (
                                              <li key={idx}>{rec}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                              </div>
                            ) : (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                  No output available
                              </p>
                            )}
                          </div>
                          </div>
                        </div>
                      </div>
                </div>
              );
              })()}
          </div>
          )}

          {/* Overall Result Summary */}
          {workflowResult && !expandedStepId && workflowResult.result && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-3">
              Overall Result
            </h4>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-900/90 p-3 text-xs text-zinc-50">
              {JSON.stringify(
                workflowResult.result.report || workflowResult.result,
                null,
                2
              )}
            </pre>
          </div>
          )}
        </section>
      )}

      {expandedMedia?.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setExpandedMedia(null)}
              className="absolute right-4 top-4 rounded-full bg-zinc-900/80 p-2 text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              aria-label="Close preview"
            >
              ✕
            </button>
            <h4 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {expandedMedia.label}
            </h4>
            {expandedMedia.type === "video" ? (
              <video
                src={expandedMedia.data}
                controls
                autoPlay
                className="max-h-[70vh] w-full rounded-2xl"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={expandedMedia.data}
                alt={expandedMedia.label}
                className="max-h-[70vh] w-full rounded-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type UploaderCardProps = {
  id: string;
  label: string;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  preview?: string;
  accept: string;
  type?: "video" | "image";
  required?: boolean;
};

function UploaderCard({
  id,
  label,
  placeholder,
  onChange,
  preview,
  accept,
  type = "image",
  required,
}: UploaderCardProps) {
  return (
    <label
      htmlFor={id}
      className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-center transition hover:border-zinc-500 hover:bg-zinc-100/90 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
    >
      <input
        id={id}
        type="file"
        accept={accept}
        required={required}
        onChange={onChange}
        className="hidden"
      />
      {preview ? (
        <div className="w-full">
          {type === "video" ? (
            <video
              src={preview}
              className="h-40 w-full rounded-xl object-cover"
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={label}
              className="h-40 w-full rounded-xl object-contain bg-white dark:bg-zinc-900"
            />
          )}
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {label}
            </p>
            <p className="text-xs text-zinc-500">{placeholder}</p>
            {required && (
              <p className="text-xs text-red-400">This asset is required.</p>
            )}
          </div>
        </div>
      )}
    </label>
  );
}


