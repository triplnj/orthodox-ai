"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/layout/LogoutButton";

type NavbarClientProps = {
  user: {
    email: string;
    plan: "FREE" | "PRO";
    subscriptionStatus?: string | null;
  } | null;
  isPro: boolean;
};

const primaryNavItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/today",
    label: "Today",
  },
  {
    href: "/chat",
    label: "Chat",
  },
  {
    href: "/prayers",
    label: "Prayers",
  },
  {
    href: "/fasting",
    label: "Fasting",
  },
  {
    href: "/confession",
    label: "Confession",
  },
  {
    href: "/scripture",
    label: "Scripture",
  },
];

const secondaryNavItems = [
    {
  href: "/confession",
  label: "Confession",
},
  {
    href: "/journal",
    label: "Journal",
  },
  {
    href: "/history",
    label: "History",
  },
  {
    href: "/account",
    label: "Account",
  },
  {
    href: "/settings",
    label: "Settings",
    },
  {
    href: "/pricing",
    label: "Pricing",
  },
];

export function NavbarClient({ user, isPro }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold text-gray-950"
            onClick={closeMenu}
          >
            OrthodoxAI
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {user && (
              <Link
                href="/account"
                className="max-w-48 truncate text-xs text-gray-500 hover:text-gray-950"
                title={user.email}
              >
                {user.email} · {isPro ? "Pro" : "Free"}
              </Link>
            )}

            {user ? (
              <LogoutButton />
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-950 hover:text-gray-950"
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Register
                </Link>
              </>
            )}

            <Link
              href="/pricing"
              className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Go Pro
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-2 text-gray-700 hover:border-gray-950 hover:text-gray-950 lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
          >
            <span className="sr-only">Open menu</span>

            <div className="space-y-1.5">
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
            </div>
          </button>
        </div>

        {isOpen && (
          <div className="border-t border-gray-100 py-4 lg:hidden">
            {user && (
              <div className="mb-4 rounded-xl bg-gray-50 p-4">
                <p className="truncate text-sm font-medium text-gray-950">
                  {user.email}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Current plan: {isPro ? "Pro" : "Free"}
                </p>
              </div>
            )}

            <nav className="grid gap-2">
              {[...primaryNavItems, ...secondaryNavItems].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4">
              {user ? (
                <LogoutButton />
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:border-gray-950 hover:text-gray-950"
                  >
                    Sign in
                  </Link>

                  <Link
                    href="/register"
                    onClick={closeMenu}
                    className="rounded-lg bg-gray-950 px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Register
                  </Link>
                </>
              )}

              <Link
                href="/pricing"
                onClick={closeMenu}
                className="rounded-lg bg-gray-950 px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
              >
                Go Pro
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}