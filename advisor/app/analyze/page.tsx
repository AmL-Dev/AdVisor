import { Suspense } from "react";
import BrandWorkflowRunner from "../components/BrandWorkflowRunner";

function AnalyzeContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl mb-3">
            Brand Alignment Analysis
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Upload your ad video and brand assets to run multi-agent critique workflow
          </p>
        </div>
        <BrandWorkflowRunner />
      </main>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-50 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  );
}

