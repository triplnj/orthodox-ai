import Link from "next/link";

type ProFeatureGateProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function ProFeatureGate({
  title,
  description,
  children,
}: ProFeatureGateProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pro feature
        </p>

        <h2 className="mt-2 text-xl font-semibold text-gray-950">{title}</h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
      </div>

      {children && <div className="mt-5">{children}</div>}

      <Link
        href="/pricing"
        className="mt-6 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}