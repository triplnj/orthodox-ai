import { ResumePaddleCheckout } from "@/components/billing/ResumePaddleCheckout";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: {
  searchParams: Promise<{ _ptxn?: string | string[] }>;
}) {
  const params = await searchParams;
  const transactionId = typeof params._ptxn === "string" ? params._ptxn : null;
  return <ResumePaddleCheckout
    transactionId={transactionId}
    token={process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN ?? null}
    enabled={process.env.NEXT_PUBLIC_PADDLE_LIVE_CHECKOUT_ENABLED === "enabled"}
  />;
}
