import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-3xl px-6 py-12"><h1 className="text-3xl font-semibold">Page not found</h1><p className="mt-3 text-gray-700">This page may have moved or may no longer be available.</p><Link href="/" className="mt-5 inline-block rounded-lg bg-gray-950 px-4 py-3 text-white">Return home</Link></main>;
}
