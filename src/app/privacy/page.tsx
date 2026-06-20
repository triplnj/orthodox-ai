import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Legal
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-950">
          Privacy Policy
        </h1>

        <p className="mt-4 text-sm leading-6 text-gray-600">
          Last updated: June 18, 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              1. Overview
            </h2>

            <p className="mt-3">
              This Privacy Policy explains how OrthodoxAI may collect, use, and
              protect information when you use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              2. Information We Collect
            </h2>

            <p className="mt-3">
              We may collect account information such as your name, email
              address, subscription status, and authentication session data.
            </p>

            <p className="mt-3">
              We may also store content you submit to the service, including
              chat messages, journal entries, prompts, and generated responses,
              so that the application can provide history, account features, and
              Pro tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              3. Payment Information
            </h2>

            <p className="mt-3">
              Payments and subscriptions may be processed by Stripe or another
              third-party payment provider. OrthodoxAI does not store full credit
              card numbers on its own servers.
            </p>

            <p className="mt-3">
              We may store payment-related identifiers such as a Stripe customer
              ID, subscription ID, plan, and subscription status in order to
              manage access to paid features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              4. How We Use Information
            </h2>

            <p className="mt-3">We may use information to:</p>

            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>create and manage user accounts,</li>
              <li>provide chat, journal, and Pro features,</li>
              <li>track usage limits for Free accounts,</li>
              <li>manage subscriptions and billing access,</li>
              <li>improve application reliability and user experience,</li>
              <li>protect the service from abuse or unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              5. Sensitive Content
            </h2>

            <p className="mt-3">
              OrthodoxAI may involve spiritual reflections, prayer questions,
              fasting questions, journal entries, and other personal content.
              You should avoid submitting highly sensitive personal,
              confidential, medical, legal, or emergency information.
            </p>

            <p className="mt-3">
              OrthodoxAI is not a secure substitute for confession, pastoral
              counseling, therapy, medical care, legal advice, or emergency
              services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              6. Cookies and Sessions
            </h2>

            <p className="mt-3">
              OrthodoxAI uses cookies or similar technologies to keep users
              signed in and to maintain secure sessions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              7. Third-Party Services
            </h2>

            <p className="mt-3">
              OrthodoxAI may use third-party services for AI generation,
              payments, hosting, analytics, database hosting, or infrastructure.
              These providers may process information as necessary to provide
              their services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              8. Data Retention
            </h2>

            <p className="mt-3">
              We may retain account data, chat messages, journal entries, usage
              logs, and billing identifiers while your account is active or as
              needed to provide the service, comply with obligations, resolve
              disputes, or maintain security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              9. Account Deletion
            </h2>

            <p className="mt-3">
              Future versions of OrthodoxAI may include account deletion and
              export tools. Until then, users may contact the operator of the
              service to request account-related assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-950">
              10. Changes to This Policy
            </h2>

            <p className="mt-3">
              We may update this Privacy Policy from time to time. The updated
              version will be posted on this page with a revised date.
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}