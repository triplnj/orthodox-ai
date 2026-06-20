import Link from "next/link";
import { isProUser, type AppUser } from "@/lib/subscription";

type ProStatusCardProps = {
  user: AppUser;
};

export function ProStatusCard({ user }: ProStatusCardProps) {
  const isPro = isProUser(user);

  return (
    <div
      className={
        isPro
          ? "rounded-2xl border border-green-200 bg-green-50 p-6"
          : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      }
    >
      <p
        className={
          isPro
            ? "text-sm font-semibold uppercase tracking-wide text-green-700"
            : "text-sm font-semibold uppercase tracking-wide text-gray-500"
        }
      >
        Current plan
      </p>

      <h2
        className={
          isPro
            ? "mt-2 text-2xl font-semibold text-green-950"
            : "mt-2 text-2xl font-semibold text-gray-950"
        }
      >
        {isPro ? "OrthodoxAI Pro" : "Free plan"}
      </h2>

      <p
        className={
          isPro
            ? "mt-3 text-sm leading-6 text-green-900"
            : "mt-3 text-sm leading-6 text-gray-600"
        }
      >
        {isPro
          ? "Your Pro access is active. You can use unlimited chat, journal tools, personal prayer plans, and Scripture reading plans."
          : "You are currently using the Free plan. Free users can ask 5 AI questions per day and access basic OrthodoxAI tools."}
      </p>

      <div className="mt-5 rounded-xl bg-white p-4 text-sm leading-6">
        <p>
          <span className="font-medium">Email:</span> {user.email}
        </p>

        <p>
          <span className="font-medium">Plan:</span> {user.plan}
        </p>

        <p>
          <span className="font-medium">Subscription status:</span>{" "}
          {user.subscriptionStatus ?? "none"}
        </p>
      </div>

      {!isPro && (
        <Link
          href="/pricing"
          className="mt-5 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          View Pro plan
        </Link>
      )}
    </div>
  );
}