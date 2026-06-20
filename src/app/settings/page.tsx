"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productCopy } from "@/lib/productCopy";

type AccountData = {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: string | null;
    plan: "FREE" | "PRO";
    subscriptionStatus: string | null;
    subscriptionId: string | null;
    stripeCustomerId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  isPro: boolean;
  stats: {
    chatCount: number;
    journalCount: number;
    todayUsage: number;
  };
};

export default function SettingsPage() {
  const router = useRouter();

  const [account, setAccount] = useState<AccountData | null>(null);
  const [name, setName] = useState("");

const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
const [verificationError, setVerificationError] = useState<string | null>(null);
const [isSendingVerification, setIsSendingVerification] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/account");
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not load settings.");
          return;
        }

        setAccount(data);
        setName(data.user.name ?? "");
      } catch {
        setError("Network error while loading settings.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAccount();
  }, []);

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingProfile(true);
    setProfileMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not update profile.");
        return;
      }

      setAccount((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                name: data.user.name,
              },
            }
          : current
      );

      setProfileMessage("Profile updated.");
      router.refresh();
    } catch {
      setError("Network error while updating profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setIsChangingPassword(true);
  setPasswordMessage(null);
  setPasswordError(null);

  try {
    const response = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setPasswordError(data.error ?? "Could not change password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password changed successfully.");
  } catch {
    setPasswordError("Network error while changing password.");
  } finally {
    setIsChangingPassword(false);
  }
}
async function resendVerificationEmail() {
  setIsSendingVerification(true);
  setVerificationMessage(null);
  setVerificationError(null);

  try {
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setVerificationError(data.error ?? "Could not send verification email.");
      return;
    }

    setVerificationMessage(data.message ?? "Verification email sent.");
  } catch {
    setVerificationError("Network error while sending verification email.");
  } finally {
    setIsSendingVerification(false);
  }
}
  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/settings/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error ?? "Could not delete account.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Network error while deleting account.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-600">Loading settings...</p>
        </div>
      </main>
    );
  }

  if (error && !account) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <h1 className="text-2xl font-bold text-red-950">Settings error</h1>

          <p className="mt-3 text-sm text-red-700">{error}</p>

          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Settings
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white-950">
          Account settings
        </h1>

        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          Manage your profile, export your data, and control your OrthodoxAI
          account.
        </p>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              Profile
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Update the display name used in your dashboard and account pages.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {profileMessage && (
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {profileMessage}
              </div>
            )}

            <form onSubmit={updateProfile} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Display name
                </label>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-semibold text-gray-950">
    Change password
  </h2>

  <p className="mt-2 text-sm leading-6 text-gray-600">
    Update your account password. Use at least 8 characters.
  </p>

  {passwordError && (
    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {passwordError}
    </div>
  )}

  {passwordMessage && (
    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
      {passwordMessage}
    </div>
  )}

  <form onSubmit={changePassword} className="mt-6 space-y-4">
    <div>
      <label className="text-sm font-medium text-gray-700">
        Current password
      </label>

      <input
        type="password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
        required
      />
    </div>

    <div>
      <label className="text-sm font-medium text-gray-700">
        New password
      </label>

      <input
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
        required
      />
    </div>

    <div>
      <label className="text-sm font-medium text-gray-700">
        Confirm new password
      </label>

      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 outline-none focus:border-gray-950"
        required
      />
    </div>

    <button
      type="submit"
      disabled={isChangingPassword}
      className="rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isChangingPassword ? "Changing password..." : "Change password"}
    </button>
  </form>
</section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              Export data
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Download a JSON export of your account data, chat messages, usage
              logs, and journal entries.
            </p>

            <a
              href="/api/settings/export"
              className="mt-6 inline-block rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:border-gray-950"
            >
              Download JSON export
            </a>
          </section>

          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-950">
              Delete account
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-800">
              This will permanently delete your OrthodoxAI account, sessions,
              chat messages, usage logs, and journal entries from this
              application database.
            </p>

            <p className="mt-3 text-sm leading-6 text-red-800">
            If you have an active Stripe subscription, OrthodoxAI will try to cancel it
            before deleting your local account. If cancellation fails, account deletion
            will stop and you should cancel billing through the billing portal first.
            </p>

            {deleteError && (
              <div className="mt-5 rounded-xl border border-red-300 bg-white p-4 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <form onSubmit={deleteAccount} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-red-950">
                  Type DELETE to confirm
                </label>

                <input
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-sm text-red-950 outline-none focus:border-red-700"
                />
              </div>

              <button
                type="submit"
                disabled={isDeleting}
                className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </button>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              Account summary
            </h2>

            <div className="mt-5 divide-y divide-gray-100 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-950">
                  {account.user.email}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                    <span className="text-gray-500">Email verified</span>
                    <span className="font-medium text-gray-950">
                    {account.user.emailVerified ? "Yes" : "No"}
                </span>
                </div>

              <div className="flex justify-between gap-4 py-3">
                <span className="text-gray-500">Plan</span>
                <span className="font-medium text-gray-950">
                  {account.isPro ? "Pro" : "Free"}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-3">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-950">
                  {account.user.subscriptionStatus ?? "none"}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-3">
                <span className="text-gray-500">Chat messages</span>
                <span className="font-medium text-gray-950">
                  {account.stats.chatCount}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-3">
                <span className="text-gray-500">Journal entries</span>
                <span className="font-medium text-gray-950">
                  {account.stats.journalCount}
                </span>
              </div>
            </div>
          </section>

          {!account.user.emailVerified && (
  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <h2 className="text-xl font-semibold text-amber-950">
      Verify your email
    </h2>

    <p className="mt-2 text-sm leading-6 text-amber-900">
      Your email address is not verified yet. Verify your email to improve
      account security and prepare your account for production features.
    </p>

    {verificationMessage && (
      <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        {verificationMessage}
      </div>
    )}

    {verificationError && (
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {verificationError}
      </div>
    )}

    <button
      type="button"
      onClick={resendVerificationEmail}
      disabled={isSendingVerification}
      className="mt-6 rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isSendingVerification ? "Sending..." : "Resend verification email"}
    </button>
  </section>
)}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              Useful links
            </h2>

            <div className="mt-5 grid gap-3">
              <Link
                href="/account"
                className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-950"
              >
                Account
              </Link>

              <Link
                href="/dashboard"
                className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-950"
              >
                Dashboard
              </Link>

              <Link
                href="/privacy"
                className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-950"
              >
                Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-950"
              >
                Terms of Service
              </Link>
            </div>
          </section>
        </aside>
      </section>

      <p className="mt-10 text-xs leading-5 text-gray-500">
        {productCopy.disclaimer}
      </p>
    </main>
  );
}