import AdGenerator from "./components/AdGenerator";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl mb-3">
            AdVisor
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-4">
            Generate professional 5-15 second ad clips with AI
          </p>
          <Link
            href="/analyze"
            className="inline-block px-6 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
          >
            Or analyze an existing ad →
          </Link>
        </div>
        <AdGenerator />
      </main>
    </div>
  );
}
