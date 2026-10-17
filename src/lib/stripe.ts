import "server-only";
import Stripe from "stripe";

export class StripeConfigurationError extends Error {
  readonly code = "STRIPE_NOT_CONFIGURED";

  constructor() {
    super("Stripe credentials are not configured for this server operation.");
    this.name = "StripeConfigurationError";
  }
}

let client: Stripe | undefined;

/** Import-safe: credentials are required only when billing is actually used. */
export function getStripe(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new StripeConfigurationError();

  // Preserve all SDK defaults used by the previous constructor.
  client = new Stripe(secretKey);
  return client;
}
