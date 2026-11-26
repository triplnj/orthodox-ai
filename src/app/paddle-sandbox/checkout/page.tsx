import { notFound } from "next/navigation";
import { PaddleSandboxCheckout } from "@/components/billing/PaddleSandboxCheckout";

export const dynamic = "force-dynamic";

/** Dedicated Sandbox checkout; never linked from production billing screens. */
export default function PaddleSandboxCheckoutPage() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    notFound();
  }

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  const checkoutEnabled = process.env.PADDLE_SANDBOX_CHECKOUT_ENABLED === "enabled" &&
    process.env.PADDLE_SANDBOX_STORE_EVENTS === "enabled";
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Preview · Paddle Sandbox only
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Test OrthodoxAI Pro checkout</h1>
      <p className="mt-3 text-gray-700">
        This is an isolated integration test, not a live payment page.
        Sign in with an account registered on this Preview deployment,
        then open checkout using a Paddle test card.
      </p>
      {!token.startsWith("test_") || !checkoutEnabled
        ? <p role="alert" className="mt-6 text-amber-700">
            Sandbox checkout is not yet enabled. Check Preview-only environment
            variables and redeploy; do not use production billing.
          </p>
        : <PaddleSandboxCheckout token={token} />}
      <p className="mt-8 text-sm text-gray-600">
        After checkout, verify the transaction and webhook in Paddle Sandbox
        and Neon QA. Do not enable automatic Pro grants yet.
      </p>
    </main>
  );
}
