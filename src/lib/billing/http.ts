import { apiJson } from "@/lib/api/response";
import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, type Provider } from "./providers";
import { checkout, deleteAccount, billingPortal } from "./service";
import { ApiError, apiFailure, parse, readJson } from "@/lib/api/validation";
import { z } from "zod";

export function billingFailure(error: unknown) {
  if (error instanceof ApiError) return apiFailure(error);
  return apiJson({ error: error instanceof BillingError ? error.message : "Billing verification is unavailable. Your billing state remains protected.", code: "BILLING_REQUEST_FAILED" },
    { status: error instanceof BillingError ? error.status : 503 });
}
export async function deletionResponse(req?: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in to delete your account." }, { status: 401 });
    if (req) {
      const body = parse(z.strictObject({ confirmation: z.literal("DELETE") }), await readJson(req, 16384));
      if (String(body?.confirmation ?? "").trim() !== "DELETE") return apiJson({ error: "You must type DELETE to confirm account deletion." }, { status: 400 });
    }
    await deleteAccount(user.id);
    const response = apiJson(req ? { success: true } : { success: true, message: "Your account has been deleted." });
    response.cookies.set("orthodoxai_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", expires: new Date(0) });
    return response;
  } catch (error) { return billingFailure(error); }
}
export async function checkoutResponse(provider: Provider) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "Unauthorized" }, { status: 401 });
    return apiJson(await checkout(user.id, provider));
  } catch (error) {
    if (error instanceof BillingError && error.status === 403 && error.message.startsWith("Please verify")) {
      return apiJson({ error: error.message, emailVerificationRequired: true }, { status: 403 });
    }
    return billingFailure(error);
  }
}
export async function portalResponse(provider?: Provider) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiJson({ error: "You must be signed in." }, { status: 401 });
    return apiJson(await billingPortal(user.id, provider));
  } catch (error) { return billingFailure(error); }
}
