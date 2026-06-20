import Link from "next/link";

type UpgradeBoxProps = {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function UpgradeBox({
  title,
  message,
  ctaLabel = "Upgrade to Pro",
  ctaHref = "/pricing",
}: UpgradeBoxProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
        Pro feature
      </p>

      <h2 className="mt-2 text-2xl font-semibold text-amber-950">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-amber-900">
        {message}
      </p>

      <Link
        href={ctaHref}
        className="mt-6 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}