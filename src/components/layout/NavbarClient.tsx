"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  {
    href: "/blog",
    label: "Blog",
  },
];

const secondaryNavItems = [
  { href: "/journal", label: "Journal" },
];

export function NavbarClient({ user, isPro }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const closeMenu = () => setIsOpen(false);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const links = (items: typeof primaryNavItems) => items.map(item => <Link key={item.href} href={item.href}
    onClick={closeMenu} aria-current={active(item.href) ? "page" : undefined}
    className={`rounded-lg px-3 py-3 text-sm font-medium ${active(item.href) ? "bg-gray-100 text-gray-950 underline underline-offset-4" : "text-gray-700 hover:bg-gray-50"}`}>{item.label}</Link>);
  return <header className="border-b border-gray-200 bg-white" onKeyDown={event => {
    if (event.key === "Escape" && isOpen) { closeMenu(); toggle.current?.focus(); }
  }}>
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
        <Link href="/" onClick={closeMenu} className="text-lg font-semibold text-gray-950">OrthodoxAI</Link>
        <div className="hidden flex-wrap items-center justify-end gap-3 lg:flex">
          {user ? <><Link href="/account" className="max-w-48 truncate text-sm text-gray-600">{user.email} | {isPro ? "Pro" : "Free"}</Link><LogoutButton /></>
            : <><Link className="px-3 py-3 text-sm" href="/login">Sign in</Link><Link className="rounded-lg bg-gray-950 px-4 py-3 text-sm text-white" href="/register">Register</Link></>}
          {!isPro && <Link className="rounded-lg bg-gray-950 px-4 py-3 text-sm text-white" href="/pricing">Full Access</Link>}
        </div>
        <button ref={toggle} type="button" aria-expanded={isOpen} aria-controls="mobile-navigation"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsOpen(current => !current)} className="rounded-lg border border-gray-300 px-3 py-3 text-sm lg:hidden">
          <span aria-hidden="true" className="inline-block space-y-1"><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /></span> Menu
        </button>
      </div>
      <div className="hidden border-t border-gray-100 py-2 lg:block">
        <nav aria-label="Primary" className="flex flex-wrap">{links(primaryNavItems)}</nav>
        <nav aria-label="Personal and account" className="flex flex-wrap border-t border-gray-100">{links(secondaryNavItems)}</nav>
      </div>
      {<div hidden={!isOpen} id="mobile-navigation" className="border-t border-gray-100 py-3 lg:hidden">
        {user && <p className="break-words px-3 py-3 text-sm text-gray-600">{user.email} | {isPro ? "Pro" : "Free"}</p>}
        <nav aria-label="Mobile primary" className="grid grid-cols-2 gap-1">{links(primaryNavItems)}</nav>
        <nav aria-label="Mobile personal and account" className="mt-2 grid grid-cols-2 gap-1 border-t border-gray-100 pt-2">{links(secondaryNavItems)}</nav>
        <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3">
          {user ? <LogoutButton /> : <><Link href="/login" onClick={closeMenu} className="rounded-lg border px-4 py-3 text-center">Sign in</Link><Link href="/register" onClick={closeMenu} className="rounded-lg bg-gray-950 px-4 py-3 text-center text-white">Register</Link></>}
          {!isPro && <Link href="/pricing" onClick={closeMenu} className="rounded-lg bg-gray-950 px-4 py-3 text-center text-white">Full Access</Link>}
        </div>
      </div>}
    </div>
  </header>;
}
