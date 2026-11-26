import Link from "next/link";

/** Checkout UI acknowledgement is not payment proof; webhook grants access. */
export default function PaddlePendingPage() {
 return (
   <main className="mx-auto max-w-2xl px-6 py-16">
     <section className="rounded-2xl border border-gray-200 bg-white p-8">
       <h1 className="text-2xl font-semibold text-gray-950">Payment submitted</h1>
       <p className="mt-4 text-gray-700">
         Paddle is confirming your transaction. OrthodoxAI Pro becomes available
         once the payment is verified by Paddle and recorded by OrthodoxAI.
         If your account still shows Free, check again shortly. Do not pay twice.
       </p>
       <Link href="/account"
         className="mt-7 inline-block rounded-lg bg-gray-950 px-6 py-3 font-semibold text-white">
         Check subscription status
       </Link>
     </section>
   </main>
 );
}
