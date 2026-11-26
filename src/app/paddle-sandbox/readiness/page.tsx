import { notFound } from "next/navigation";
import { PaddleSandboxReadiness } from "@/components/billing/PaddleSandboxReadiness";

export const dynamic = "force-dynamic";

/** Isolated Preview-only diagnostic, never an entry point for real payments. */
export default function PaddleSandboxReadinessPage() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    notFound();
  }

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Preview only</p>
      <h1 className="mt-3 text-3xl font-semibold">Paddle Sandbox readiness</h1>
      <p className="mt-3 text-gray-700">
        This isolated diagnostic does not perform payments or grant Pro access.
      </p>
      {!token.startsWith("test_")
        ? <p role="alert" className="mt-6 text-red-700">
            Sandbox client-side token is not configured for this Preview build.
          </p>
        : <PaddleSandboxReadiness token={token} />}
    </main>
  );
}
