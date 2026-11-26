import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { PaddleQaActivateButton } from "@/components/billing/PaddleQaActivateButton";

export const dynamic = "force-dynamic";

/** QA-only page, protected by both deployment and server-side account checks. */
export default async function PaddleQaActivationPage() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    notFound();
  }
  const user = await getSessionUser();
  if (!user || user.id !== "qa_patristic_20261109" ||
      user.email !== "patristic-qa@example.test" ||
      !user.emailVerified || user.billingDeletionRequestedAt) {
    notFound();
  }
  const enabled = process.env.PADDLE_SANDBOX_GRANT_ACCESS === "enabled";
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Isolated Paddle Sandbox QA
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Verify existing Paddle payment</h1>
      <p className="mt-4 text-gray-700">
        The previous Sandbox payment was verified, but the entitlement is not
        yet saved. This tool rechecks Paddle directly and saves access only to
        the dedicated Neon QA branch.
      </p>
      {enabled
        ? <PaddleQaActivateButton />
        : <p role="alert" className="mt-6 text-amber-700">
            The Sandbox grant flag is disabled. Do not try to activate until
            PADDLE_SANDBOX_GRANT_ACCESS is enabled for this Preview branch
            and a new deployment is READY.
          </p>}
    </main>
  );
}
