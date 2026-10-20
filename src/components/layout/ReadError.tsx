"use client";
import Link from "next/link";
/** The retry callback must load data only; never replay a write. */
export function ReadError({ message, authenticationRequired, retry }: { message: string; authenticationRequired: boolean; retry: () => void }) {
  return <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <p>{message}</p><div className="mt-3 flex flex-wrap gap-3">{authenticationRequired
      ? <Link href="/login" className="rounded-lg border border-red-300 bg-white px-4 py-3 underline">Sign in again</Link>
      : <button type="button" onClick={retry} className="rounded-lg border border-red-300 bg-white px-4 py-3">Try loading again</button>}</div>
  </div>;
}
