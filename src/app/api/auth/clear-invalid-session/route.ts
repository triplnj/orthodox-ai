import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { clearSessionCookie } from "@/lib/security/auth-http";

export async function GET(req: Request) {
  const valid = await getSessionUser();
  const response = NextResponse.redirect(new URL(valid ? "/dashboard" : "/login", req.url));
  if (!valid) clearSessionCookie(response);
  return response;
}
