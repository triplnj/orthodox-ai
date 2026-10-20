"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function handleLogout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/"); router.refresh();
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={handleLogout} className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-950">{busy ? "Signing out..." : "Logout"}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">Could not confirm sign-out. Please try again.</p>}</div>;
}
