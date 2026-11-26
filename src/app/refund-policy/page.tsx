import Link from "next/link";

export const metadata = {
  title: "Refund Policy | OrthodoxAI",
  description: "Refunds, cancellation and withdrawal rights for OrthodoxAI Pro subscriptions.",
};

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">Refund Policy</h1>
        <p className="mt-4 text-sm text-gray-600">Last updated: November 26, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-950">1. Digital subscription</h2>
            <p className="mt-3">
              OrthodoxAI Pro is a digital software subscription. The currently advertised Pro plan is
              USD $7.99 per month, billed on a recurring basis until canceled. Features and
              billing details are described on our <Link href="/pricing" className="underline">Pricing page</Link>.
              No physical goods are shipped.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">2. Payment processing and refunds</h2>
            <p className="mt-3">
              Where a purchase is processed by Paddle, Paddle acts as the merchant of record and
              authorized reseller. Refund requests, applicable rights of withdrawal, and refund
              eligibility are handled under the
              {" "}<a className="underline" href="https://www.paddle.com/legal/refund-policy"
                target="_blank" rel="noopener noreferrer">Paddle Refund Policy</a> and
              applicable consumer protection laws. Nothing on this page limits mandatory consumer
              rights or any more favorable rights that apply to a purchase.
            </p>
            <p className="mt-3">
              A request for a discretionary refund does not automatically guarantee approval.
              Paddle evaluates refund eligibility under its policy and applicable law, including
              any statutory withdrawal period, payment dispute or material product defect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">3. How to request a refund</h2>
            <p className="mt-3">
              For purchases charged by Paddle, visit
              {" "}<a className="underline" href="https://paddle.net"
                target="_blank" rel="noopener noreferrer">Paddle Buyer Support</a>, or use the
              support or refund link in your receipt or Paddle customer portal.
              Include the transaction reference and the email address used at checkout.
              Do not send card details or passwords to OrthodoxAI.
            </p>
            <p className="mt-3">
              If your purchase was processed by a different payment provider, use the payment
              confirmation or billing support details provided with that purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">4. Canceling future renewals</h2>
            <p className="mt-3">
              You may cancel a Pro subscription at any time using the
              {" "}<Link className="underline" href="/account">Account</Link> billing controls
              or the subscription-management link in your purchase receipt.
              Cancellation stops future renewals; it is not automatically a refund of a previous
              charge. Unless a refund or another applicable circumstance ends access earlier,
              access generally remains available through the paid billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">5. Errors and access issues</h2>
            <p className="mt-3">
              If payment was taken but Pro access was not activated, do not make another purchase
              while the first payment is being investigated. Check your billing status in your
              account, then contact the payment provider using the details on your receipt.
              For purchases made through Paddle, you can also use
              {" "}<a className="underline" href="https://paddle.net" target="_blank"
                rel="noopener noreferrer">Paddle Buyer Support</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">6. Related policies</h2>
            <p className="mt-3">
              See our <Link href="/terms" className="underline">Terms of Service</Link> and
              {" "}<Link href="/privacy" className="underline">Privacy Policy</Link>.
              Your payment receipt and the payment processor&apos;s buyer terms may contain
              additional transaction-specific details.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
