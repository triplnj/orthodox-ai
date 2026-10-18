import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, type Provider } from "./providers";
import { checkout, deleteAccount, billingPortal } from "./service";

export function billingFailure(error: unknown) {
  return NextResponse.json({ error: error instanceof BillingError ? error.message : "Billing verification is unavailable. Your billing state remains protected." },
    { status: error instanceof BillingError ? error.status : 503 });
}
export async function deletionResponse(req?: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "You must be signed in to delete your account." }, { status: 401 });
    if (req) {
      let body;
      try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 }); }
      if (String(body?.confirmation ?? "").trim() !== "DELETE") return NextResponse.json({ error: "You must type DELETE to confirm account deletion." }, { status: 400 });
    }
    await deleteAccount(user.id);
    const response = NextResponse.json(req ? { success: true } : { success: true, message: "Your account has been deleted." });
    response.cookies.set("orthodoxai_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", expires: new Date(0) });
    return response;
  } catch (error) { return billingFailure(error); }
}
export async function checkoutResponse(provider: Provider) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await checkout(user.id, provider));
  } catch (error) {
    if (error instanceof BillingError && error.status === 403 && error.message.startsWith("Please verify")) {
      return NextResponse.json({ error: error.message, emailVerificationRequired: true }, { status: 403 });
    }
    return billingFailure(error);
  }
}
export async function portalResponse(provider?: Provider) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    return NextResponse.json(await billingPortal(user.id, provider));
  } catch (error) { return billingFailure(error); }
}
