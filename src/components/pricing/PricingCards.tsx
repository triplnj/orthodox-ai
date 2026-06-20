import Link from "next/link";
import { productCopy } from "@/lib/productCopy";
// import { CheckoutButton } from "@/components/billing/CheckoutButton";

export function PricingCards() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-gray-950">
            {productCopy.freePlan.name}
          </h2>

          <p className="mt-3 text-4xl font-bold text-gray-950">
            {productCopy.freePlan.price}
          </p>

          <p className="mt-3 text-sm leading-6 text-gray-600">
            {productCopy.freePlan.description}
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {productCopy.freePlan.features.map((feature) => (
            <li
              key={feature}
              className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700"
            >
              {feature}
            </li>
          ))}
        </ul>

        <Link
          href="/chat"
          className="mt-8 block rounded-lg border border-gray-300 px-5 py-3 text-center text-sm font-semibold text-gray-800 hover:border-gray-950"
        >
          Start free
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-950 bg-gray-950 p-8 text-white shadow-sm">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">
              {productCopy.proPlan.name}
            </h2>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-950">
              Recommended
            </span>
          </div>

          <p className="mt-3 text-4xl font-bold">
            {productCopy.proPlan.price}
          </p>

          <p className="mt-2 text-sm text-gray-300">
            Or {productCopy.proPlan.yearlyPrice}
          </p>

          <p className="mt-3 text-sm leading-6 text-gray-300">
            {productCopy.proPlan.description}
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {productCopy.proPlan.features.map((feature) => (
            <li
              key={feature}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-gray-100"
            >
              {feature}
            </li>
          ))}
        </ul>

       <Link
        href="/pro"
            className="mt-8 block rounded-lg bg-white px-5 py-3 text-center text-sm font-semibold text-gray-950 hover:bg-gray-100"
            >
            Upgrade to Pro
            </Link>
      </div>
    </section>
  );
}