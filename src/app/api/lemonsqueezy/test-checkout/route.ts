import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function testAccess(id: string): boolean {
  const allowed = [process.env.BLOG_ADMIN_USER_IDS, process.env.BILLING_TEST_USER_IDS]
    .flatMap(value => (value ?? "").split(",").map(item => item.trim()).filter(Boolean));
  return allowed.includes(id);
}
function required(name: string): string | null {
  return process.env[name]?.trim() || null;
}
async function requestTest(path: string, token: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1/${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error("Test provider request failed");
  return res.json() as Promise<{ data?: { id?: string; type?: string; attributes?: { url?: string; expires_at?: string; test_mode?: boolean } } }>;
}
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.emailVerified || !testAccess(user.id)) {
    return NextResponse.json({ error: "Billing test access is restricted." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const key = required("LEMONSQUEEZY_TEST_API_KEY");
  const store = required("LEMONSQUEEZY_TEST_STORE_ID");
  const variant = required("LEMONSQUEEZY_TEST_PRO_VARIANT_ID");
  const appUrl = required("NEXT_PUBLIC_APP_URL");
  if (!key || !store || !variant || !appUrl || !required("LEMONSQUEEZY_TEST_WEBHOOK_SECRET")) {
    return NextResponse.json({ error: "Test billing configuration is incomplete. Configure separate TEST API key, store, variant and webhook secret." }, { status: 503 });
  }
  try {
    const verification = (await requestTest(`variants/${encodeURIComponent(variant)}`, key)).data;
    if (verification?.type !== "variants" || String(verification.id) !== variant || verification.attributes?.test_mode !== true) {
      return NextResponse.json({ error: "The configured test variant is not in Lemon Squeezy Test Mode." }, { status: 503 });
    }
    const attempt = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`billing-test:${user.id}`}, 0))`;
      const previous = await tx.billingCheckoutAttempt.findFirst({
        where: { userId: user.id, provider: "LEMONSQUEEZY_TEST", status: { in: ["CREATING", "OPEN", "UNKNOWN"] } },
        orderBy: { createdAt: "desc" },
      });
      if (previous?.status === "OPEN" && previous.checkoutUrl && previous.expiresAt && previous.expiresAt > new Date()) {
        return { url: previous.checkoutUrl };
      }
      if (previous?.status === "CREATING" || previous?.status === "UNKNOWN") {
        throw new Error("A test checkout is unresolved. Ask an administrator to inspect it before retrying.");
      }
      if (previous) {
        await tx.billingCheckoutAttempt.update({ where: { id: previous.id },
          data: { status: "RECONCILED", checkoutUrl: null } });
      }
      const created = await tx.billingCheckoutAttempt.create({ data: { userId: user.id, provider: "LEMONSQUEEZY_TEST" } });
      return { id: created.id };
    });
    if ("url" in attempt) return NextResponse.json({ url: attempt.url, mode: "TEST" });
    try {
      const result = (await requestTest("checkouts", key, "POST", {
        data: { type: "checkouts",
          relationships: {
            store: { data: { type: "stores", id: store } },
            variant: { data: { type: "variants", id: variant } },
          },
          attributes: { test_mode: true,
            checkout_data: { email: user.email, name: user.name ?? undefined,
              custom: { userId: user.id, billingAttemptId: attempt.id } },
            product_options: { redirect_url: `${appUrl}/admin/billing-test?returned=1` },
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
        },
      })).data;
      if (!result?.id || !result.attributes?.url || result.attributes.test_mode !== true) {
        throw new Error("Provider did not confirm a TEST checkout.");
      }
      const expiresAt = result.attributes.expires_at ? new Date(result.attributes.expires_at) : null;
      if (!expiresAt || !Number.isFinite(expiresAt.getTime())) throw new Error("Invalid provider expiry");
      await prisma.billingCheckoutAttempt.updateMany({
        where: { id: attempt.id, userId: user.id, status: "CREATING" },
        data: { status: "OPEN", providerCheckoutId: String(result.id), checkoutUrl: result.attributes.url, expiresAt },
      });
      return NextResponse.json({ url: result.attributes.url, mode: "TEST" });
    } catch {
      await prisma.billingCheckoutAttempt.updateMany({ where: { id: attempt.id, status: "CREATING" }, data: { status: "UNKNOWN" } });
      return NextResponse.json({ error: "Test checkout could not be confirmed. Check test orders before retrying." }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "Test checkout is unavailable or awaiting reconciliation." }, { status: 503 });
  }
}
