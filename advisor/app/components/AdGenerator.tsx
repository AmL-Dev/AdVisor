"use client";

import { useState } from "react";

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";

interface FormData {
  companyName: string;
  productName: string;
  brandLogo: string;
  productImage: string;
  briefPrompt: string;
  aspectRatio: AspectRatio;
  validatePrompt: boolean;
}

interface PromptResponse {
  prompt: any;
  promptText: string;
  status?: string;
  message?: string;
}

export default function AdGenerator() {
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    productName: "",
    brandLogo: "",
    productImage: "",
    briefPrompt: "",
    aspectRatio: "16:9",
    validatePrompt: false,
  });

  const [logoPreview, setLogoPreview] = useState<string>("");
  const [productPreview, setProductPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [generatedPrompt, setGeneratedPrompt] = useState<PromptResponse | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState<"form" | "prompt-review" | "video" | "generating">("form");

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "product"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (type === "logo") {
        setFormData({ ...formData, brandLogo: base64 });
        setLogoPreview(base64);
      } else {
        setFormData({ ...formData, productImage: base64 });
        setProductPreview(base64);
      }
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/generate_add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate prompt");
      }

      if (formData.validatePrompt) {
        setGeneratedPrompt(data);
        setStep("prompt-review");
      } else {
        if (data.video && data.prompt && data.promptText) {
          setVideoUrl(data.video);
          setGeneratedPrompt({
            prompt: data.prompt,
            promptText: data.promptText,
            status: "generated",
            message: data.message,
          });
          setStep("video");
        } else {
          throw new Error("Video generation response missing data");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const generateVideo = async (prompt: any, promptText?: string) => {
    if (!promptText) {
      setError("Prompt text is required to generate the video.");
      return;
    }

    setLoading(true);
    setError("");
    setStep("generating");
    setLoadingMessage("Generating your ad video... This may take a few minutes.");

    try {
      const response = await fetch("/api/generate_add/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          productName: formData.productName,
          brandLogo: formData.brandLogo,
          productImage: formData.productImage,
          veo3Prompt: prompt,
          promptText: promptText,
          aspectRatio: formData.aspectRatio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate video");
      }

      if (data.video) {
        setVideoUrl(data.video);
        setStep("video");
      } else if (data.videoGcsUri) {
        setError(`Video generated successfully but is stored in Google Cloud Storage: ${data.videoGcsUri}. Please download it from there.`);
        setStep("form");
      } else if (data.videoFile) {
        // Video was generated but we couldn't download it directly
        // Log the video file object for debugging
        console.log("Video file object:", data.videoFile);
        setError("Video generated successfully, but automatic download failed. Check the browser console for video file details.");
        setStep("form");
      } else {
        setError("Video generation completed but no video data was returned.");
        setStep("form");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStep("form");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleConfirmPrompt = async () => {
    if (generatedPrompt) {
      await generateVideo(generatedPrompt.prompt, generatedPrompt.promptText);
    }
  };

  const handleBack = () => {
    setStep("form");
    setGeneratedPrompt(null);
    setVideoUrl("");
  };

  const handleReset = () => {
    setFormData({
      companyName: "",
      productName: "",
      brandLogo: "",
      productImage: "",
      briefPrompt: "",
      aspectRatio: "16:9",
      validatePrompt: false,
    });
    setLogoPreview("");
    setProductPreview("");
    setGeneratedPrompt(null);
    setVideoUrl("");
    setStep("form");
    setError("");
  };

  if (step === "prompt-review" && generatedPrompt) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Review Generated Prompt
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Please review the generated prompt before proceeding with video generation.
          </p>
        </div>

        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Prompt Details (JSON):</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(generatedPrompt.prompt, null, 2));
              }}
              className="text-xs px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto font-mono">
            {JSON.stringify(generatedPrompt.prompt, null, 2)}
          </pre>
        </div>

        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Text Prompt:</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedPrompt.promptText);
              }}
              className="text-xs px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {generatedPrompt.promptText}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleBack}
            className="flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
          >
            Back to Edit
          </button>
          <button
            onClick={handleConfirmPrompt}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating Video..." : "Confirm & Generate Video"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col items-center justify-center py-12">
          <svg
            className="animate-spin h-12 w-12 text-zinc-900 dark:text-zinc-50 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Generating Your Ad
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-center max-w-md">
            {loadingMessage || "This may take a few minutes. Please don't close this page."}
          </p>
          <div className="mt-6 w-full max-w-xs bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-zinc-900 dark:bg-zinc-50 rounded-full animate-pulse" style={{ width: "60%" }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "video" && videoUrl) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Your Ad is Ready! 🎉
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Your 5-15 second ad clip has been generated successfully.
          </p>
        </div>

        <div className="mb-6 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <video
            src={videoUrl}
            controls
            className="w-full h-auto"
            autoPlay
            loop
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href={videoUrl}
            download="ad-clip.mp4"
            className="flex-1 px-6 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-center"
          >
            Download Video
          </a>
          <a
            href={`/analyze?video=${encodeURIComponent(videoUrl)}&companyName=${encodeURIComponent(formData.companyName)}&productName=${encodeURIComponent(formData.productName)}&logo=${encodeURIComponent(formData.brandLogo)}&product=${encodeURIComponent(formData.productImage)}`}
            className="flex-1 px-6 py-3 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium text-center"
          >
            Analyze Ad
          </a>
          <button
            onClick={handleReset}
            className="flex-1 px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium"
          >
            Create New Ad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            required
            value={formData.companyName}
            onChange={(e) =>
              setFormData({ ...formData, companyName: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 transition"
            placeholder="e.g., TechGadget Inc."
          />
        </div>

        {/* Product Name */}
        <div>
          <label
            htmlFor="productName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="productName"
            required
            value={formData.productName}
            onChange={(e) =>
              setFormData({ ...formData, productName: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 transition"
            placeholder="e.g., SmartWidget Pro"
          />
        </div>

        {/* Image Uploads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Brand Logo */}
          <div>
            <label
              htmlFor="brandLogo"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Brand Logo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                id="brandLogo"
                accept="image/*"
                required
                onChange={(e) => handleImageUpload(e, "logo")}
                className="hidden"
              />
              <label
                htmlFor="brandLogo"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-zinc-50 dark:bg-zinc-800"
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : (
                  <>
                    <svg
                      className="w-8 h-8 text-zinc-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Click to upload logo
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Product Image */}
          <div>
            <label
              htmlFor="productImage"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Product Image <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                id="productImage"
                accept="image/*"
                required
                onChange={(e) => handleImageUpload(e, "product")}
                className="hidden"
              />
              <label
                htmlFor="productImage"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-zinc-50 dark:bg-zinc-800"
              >
                {productPreview ? (
                  <img
                    src={productPreview}
                    alt="Product preview"
                    className="h-full w-full object-contain rounded-lg"
                  />
                ) : (
                  <>
                    <svg
                      className="w-8 h-8 text-zinc-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Click to upload product
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Brief Prompt */}
        <div>
          <label
            htmlFor="briefPrompt"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Brief Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="briefPrompt"
            required
            rows={4}
            value={formData.briefPrompt}
            onChange={(e) =>
              setFormData({ ...formData, briefPrompt: e.target.value })
            }
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 transition resize-none"
            placeholder="Describe your ad concept... e.g., A sleek smartphone floating in a minimalist studio with soft lighting, showcasing its premium design and features."
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <label
            htmlFor="aspectRatio"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
          >
            Aspect Ratio
          </label>
          <select
            id="aspectRatio"
            value={formData.aspectRatio}
            onChange={(e) =>
              setFormData({
                ...formData,
                aspectRatio: e.target.value as AspectRatio,
              })
            }
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 transition"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="4:3">4:3 (Classic)</option>
            <option value="21:9">21:9 (Ultrawide)</option>
          </select>
        </div>

        {/* Prompt Validation Toggle */}
        <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <input
            type="checkbox"
            id="validatePrompt"
            checked={formData.validatePrompt}
            onChange={(e) =>
              setFormData({ ...formData, validatePrompt: e.target.checked })
            }
            className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
          <label
            htmlFor="validatePrompt"
            className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            Review prompt before generating video
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-4 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {formData.validatePrompt
                ? "Generating Prompt..."
                : "Generating Video..."}
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {formData.validatePrompt
                ? "Generate Prompt"
                : "Generate Video"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

