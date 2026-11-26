import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Dict = Record<string, unknown>;
const obj = (x: unknown): Dict | null =>
 x && typeof x === "object" && !Array.isArray(x) ? x as Dict : null;

/** Read-only readiness probe. Restricted to an explicitly configured admin ID. */
export async function GET(request: Request) {
 const headers = { "Cache-Control": "no-store" };
 if (process.env.VERCEL_ENV !== "production")
   return NextResponse.json({ error: "Not found." }, { status: 404, headers });
 const user = await getSessionUser();
 const admins = (process.env.BLOG_ADMIN_USER_IDS ?? "").split(",").map(x => x.trim()).filter(Boolean);
 if (!user?.emailVerified || !admins.includes(user.id))
   return NextResponse.json({ error: "Not found." }, { status: 404, headers });
 const issues: string[] = [];
 const key = process.env.PADDLE_LIVE_API_KEY ?? "";
 const productId = process.env.PADDLE_LIVE_PRO_PRODUCT_ID ?? "";
 const priceId = process.env.PADDLE_LIVE_PRO_PRICE_ID ?? "";
 if (!key.startsWith("pdl_live_apikey_") ||
     !/^pro_[a-z0-9]{26}$/.test(productId) ||
     !/^pri_[a-z0-9]{26}$/.test(priceId)) {
   return NextResponse.json({ ready: false, issues: ["Invalid Live credentials or catalog configuration."] },
     { status: 503, headers });
 }
 async function get(path: string): Promise<{ status: number; data: unknown }> {
   try {
     const response = await fetch("https://api.paddle.com" + path, {
       headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
       cache: "no-store", signal: AbortSignal.timeout(10000),
     });
     if (!response.ok) return { status: response.status, data: null };
     const json: unknown = await response.json();
     return { status: response.status, data: obj(json)?.data ?? null };
   } catch { return { status: 503, data: null }; }
 }
 const [product, price, verification, domains, checkout, adjustments] = await Promise.all([
   get("/products/" + productId),
   get("/prices/" + priceId),
   get("/verifications?verification_type=onboarding"),
   get("/checkout-domains"),
   get("/settings/checkout-url"),
   get("/adjustments?per_page=1"),
 ]);
 const p = obj(product.data), pr = obj(price.data);
 if (product.status !== 200 || p?.id !== productId || p?.status !== "active")
   issues.push("Live product is unavailable or inactive.");
 const unitPrice = obj(pr?.unit_price), cycle = obj(pr?.billing_cycle);
 if (price.status !== 200 || pr?.id !== priceId || pr?.product_id !== productId ||
     pr?.status !== "active" || unitPrice?.currency_code !== "USD" ||
     unitPrice?.amount !== "799" || cycle?.interval !== "month" || cycle?.frequency !== 1)
   issues.push("Live recurring monthly price is not verified as USD 7.99.");
 if (verification.status !== 200 || !Array.isArray(verification.data) ||
     !verification.data.some(x => {
       const v = obj(x);
       return v?.verification_type === "onboarding" && v?.status === "completed";
     })) issues.push("Live Paddle seller approval not verified (verification.read needed).");
 if (domains.status !== 200 || !Array.isArray(domains.data) ||
     !domains.data.some(x => {
       const d = obj(x);
       return d?.domain === "www.orthodoxai.app" && d?.status === "approved";
     })) issues.push("Production checkout domain approval not verified (checkout_domain.read needed).");
 const defaultUrl = obj(checkout.data)?.default_url;
 if (checkout.status !== 200 || defaultUrl !== "https://www.orthodoxai.app/pricing")
   issues.push("Default payment URL not verified as the approved pricing page (checkout_settings.read needed).");
 if (adjustments.status !== 200 || !Array.isArray(adjustments.data))
   issues.push("Refund protection requires adjustment.read permission on the API key.");

 return NextResponse.json({
   ready: issues.length === 0,
   issues,
   checkoutEnabled: process.env.PADDLE_LIVE_CHECKOUT_ENABLED === "enabled",
   webhookEnabled: process.env.PADDLE_LIVE_WEBHOOK_ENABLED === "enabled",
   grantEnabled: process.env.PADDLE_LIVE_GRANT_ACCESS === "enabled",
   transactionCreationEnabled: false,
 }, { headers });
}
