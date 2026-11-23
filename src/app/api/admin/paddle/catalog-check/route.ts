import { NextResponse } from "next/server";
import { PADDLE_SANDBOX_CATALOG, assertPaddleSandboxCatalog } from "@/lib/billing/paddle-sandbox-catalog";

export const dynamic = "force-dynamic";

type PaddleProduct = { data?: { id?: string; name?: string; status?: string } };
type PaddlePrice = { data?: {
  id?: string; product_id?: string; status?: string;
  billing_cycle?: { interval?: string; frequency?: number } | null;
  unit_price?: { amount?: string; currency_code?: string };
} };

async function fetchCatalog<T>(path: string, key: string): Promise<{ status: number; data?: T }> {
  const response = await fetch(`https://sandbox-api.paddle.com/${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return { status: response.status };
  return { status: response.status, data: await response.json() as T };
}

/** Public Sandbox catalog metadata (Preview only); no secrets or private data returned. Never writes to Neon. */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/paddle-transition-phase1-20261120") {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  // Read-only and Preview-branch-only: the response contains only public
  // catalog identifiers, status and price, never credentials or customer data.
  // No auth/session/Neon dependency is permitted in this diagnostic endpoint.
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key || !key.startsWith("pdl_sdbx_apikey_")) {
    return NextResponse.json({ verified: false, error: "Sandbox integration not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  assertPaddleSandboxCatalog(PADDLE_SANDBOX_CATALOG.productId, PADDLE_SANDBOX_CATALOG.monthlyPriceId, "sandbox");
  try {
    const [product, price] = await Promise.all([
      fetchCatalog<PaddleProduct>(`products/${PADDLE_SANDBOX_CATALOG.productId}`, key),
      fetchCatalog<PaddlePrice>(`prices/${PADDLE_SANDBOX_CATALOG.monthlyPriceId}`, key),
    ]);
    if (product.status !== 200 || price.status !== 200) {
      return NextResponse.json({
        verified: false,
        error: "Paddle Sandbox catalog could not be verified. Check key permissions and IDs.",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const p = product.data?.data;
    const c = price.data?.data;
    const verified =
      p?.id === PADDLE_SANDBOX_CATALOG.productId && p.status === "active" &&
      c?.id === PADDLE_SANDBOX_CATALOG.monthlyPriceId &&
      c.product_id === p.id && c.status === "active" &&
      c.billing_cycle?.interval === "month" && c.billing_cycle.frequency === 1 &&
      c.unit_price?.currency_code === "USD" && c.unit_price?.amount === "799";
    return NextResponse.json({
      verified,
      productId: p?.id ?? null,
      productName: p?.name ?? null,
      productStatus: p?.status ?? null,
      priceId: c?.id ?? null,
      priceStatus: c?.status ?? null,
      currency: c?.unit_price?.currency_code ?? null,
      amountMinorUnits: c?.unit_price?.amount ?? null,
      billingInterval: c?.billing_cycle?.interval ?? null,
      billingFrequency: c?.billing_cycle?.frequency ?? null,
      mode: "SANDBOX_READ_ONLY",
    }, { status: verified ? 200 : 409, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ verified: false, error: "Paddle Sandbox request failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
