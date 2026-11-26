/** Isolated Sandbox catalog identifiers. Never use these for production billing. */
export const PADDLE_SANDBOX_CATALOG = Object.freeze({
  productId: "pro_01m84hpaffkkag5zftcz3nk9qz",
  monthlyPriceId: "pri_01m84j47gzd7tw449trss5wsh4",
} as const);

/**
 * Fail closed if someone accidentally uses the Sandbox catalog in production.
 * A live catalog must be provisioned and verified separately before go-live.
 */
export function assertPaddleSandboxCatalog(productId: string, priceId: string, environment: string) {
  if (environment !== "sandbox" ||
      productId !== PADDLE_SANDBOX_CATALOG.productId ||
      priceId !== PADDLE_SANDBOX_CATALOG.monthlyPriceId) {
    throw new Error("Paddle Sandbox catalog/environment mismatch.");
  }
}
