import { getSessionUser } from "@/lib/session";
import { apiJson } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * Temporary authenticated, verified-account-only, read-only Lemon Squeezy Live configuration check.
 * Never return or log API keys, API responses, URLs or customer data.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.emailVerified) {
    return apiJson({ error: "Not found." }, { status: 404 });
  }

  const key = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  if (!key || !storeId || !variantId) {
    return apiJson({ error: "Billing configuration incomplete." }, { status: 503 });
  }

  const productId = "1190585";
  const apiRoot = "https://api.lemonsqueezy.com/v1/";
  const paths = [
    `variants/${encodeURIComponent(variantId)}`,
    `products/${productId}`,
    `variants?filter[product_id]=${productId}&page[size]=100`,
  ] as const;

  const probes = await Promise.all(paths.map(async path => {
    try {
      const res = await fetch(apiRoot + path, {
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { status: res.status, data: null };
      const body: unknown = await res.json();
      if (!body || typeof body !== "object" || !("data" in body)) {
        return { status: res.status, data: null };
      }
      return { status: res.status, data: body.data };
    } catch {
      return { status: 0, data: null };
    }
  }));

  type Resource = {
    id?: unknown;
    type?: unknown;
    attributes?: {
      store_id?: unknown;
      product_id?: unknown;
      test_mode?: unknown;
    };
  };

  const direct = probes[0].data as Resource | null;
  const product = probes[1].data as Resource | null;
  const variants = Array.isArray(probes[2].data) ? probes[2].data as Resource[] : [];
  const match = variants.find(v => String(v.id) === variantId);
  const shape = (r: Resource | null | undefined) => r ? ({
    correctId: String(r.id) === (r.type === "products" ? productId : variantId),
    live: r.attributes?.test_mode === false,
    storeMatches: String(r.attributes?.store_id) === storeId,
  }) : null;

  return apiJson({
    diagnostic: "lemon-live-readonly-v1",
    expectedProduct: productId,
    expectedVariant: variantId,
    expectedStore: storeId,
    directVariant: { httpStatus: probes[0].status, ...shape(direct) },
    product: { httpStatus: probes[1].status, ...shape(product) },
    productVariantList: {
      httpStatus: probes[2].status,
      variantFound: !!match,
      listedCount: variants.length,
      ...(match ? { variantLive: match.attributes?.test_mode === false,
        variantProductMatches: String(match.attributes?.product_id) === productId } : {}),
    },
  }, { headers: { "Cache-Control": "no-store, private" } });
}
