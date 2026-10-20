import { apiJson } from "@/lib/api/response";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { webhook } from "@/lib/billing/service";
import { billingFailure } from "@/lib/billing/http";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return apiJson({ error: "Missing Stripe signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Webhook configuration unavailable");
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch { return apiJson({ error: "Invalid Stripe webhook signature." }, { status: 400 }); }
  try {
    let subscriptionId: string | undefined;
    let customerId: string | undefined;
    let userId: string | undefined;
    let attemptId: string | undefined;
    if (event.type.startsWith("customer.subscription.")) {
      const s = event.data.object as Stripe.Subscription;
      subscriptionId = s.id;
      customerId = typeof s.customer === "string" ? s.customer : s.customer.id;
      userId = s.metadata?.userId;
      attemptId = s.metadata?.billingAttemptId;
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      subscriptionId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      userId = s.metadata?.userId;
      attemptId = s.metadata?.billingAttemptId;
    }
    if (subscriptionId) await webhook({ provider: "STRIPE", eventId: event.id, eventType: event.type,
      subscriptionId, customerId, userId, attemptId, rawBody, occurredAt: new Date(event.created * 1000) });
    return apiJson({ received: true });
  } catch (error) { return billingFailure(error); }
}
