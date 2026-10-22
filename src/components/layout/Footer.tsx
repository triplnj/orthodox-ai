import Link from "next/link";
import { productCopy } from "@/lib/productCopy";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-gray-700">
            © {year} {productCopy.brandName}. All rights reserved by
            Богоискатељ.
          </p>

        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-medium md:justify-end">
          {[
            { href: "/journal", label: "Journal" },
            { href: "/history", label: "History" },
            { href: "/account", label: "Account" },
            { href: "/settings", label: "Settings" },
            { href: "/pricing", label: "Pricing" },
          ].map(item => <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center py-2 hover:text-gray-950">{item.label}</Link>)}
          <Link href="/terms" className="inline-flex min-h-11 items-center py-2 hover:text-gray-950">
            Terms
          </Link>

          <Link href="/privacy" className="inline-flex min-h-11 items-center py-2 hover:text-gray-950">
            Privacy
          </Link>

          <Link href="/disclaimer" className="inline-flex min-h-11 items-center py-2 hover:text-gray-950">
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}