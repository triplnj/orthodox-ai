import "server-only";
import { diagnostic } from "@/lib/diagnostics";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { AuthError, authFailure, authJson, emailAddress, newPassword, text, tokenValue } from "./auth-input";
import { authLimit, emailLimit } from "./auth-limits";
import * as service from "./auth-service";
import { queryInput } from "@/lib/api/validation";

const registrationMessage = "If registration can proceed, check your email for the next steps. You can sign in to request another verification email.";
const resetMessage = "If an account exists for this email, password reset instructions will be sent.";
function queueEmail(mail: Awaited<ReturnType<typeof service.issueEmail>>) {
  if (mail) after(async () => {
    try { await service.deliverEmail(mail); }
    catch { diagnostic("operation_failed", { operation: "auth", failure: "provider" }); }
  });
}
export async function authenticationResponse(req: Request, action: "login" | "register" | "forgot" | "verify" | "reset" | "resend" | "password") {
  try {
    await authLimit(req, action);
    queryInput(req);
    if (action === "resend" || action === "password") {
      // Authentication-only reads must not invoke billing or AI services.
      const user = await getSessionUser();
      if (!user) throw new AuthError("You must be signed in.", 401);
      await authLimit(req, action, user.id, false);
      if (action === "resend") {
        if (req.body && Object.keys(await authJson(req)).length) throw new AuthError("Unexpected verification request fields.");
        await emailLimit(user.email);
        queueEmail(await service.issueEmail(user.id, "verify"));
        return NextResponse.json({ message: "If verification is needed, an email will be sent. Please allow a minute before retrying." }, { status: 202 });
      }
      const body = await authJson(req);
      if (Object.keys(body).some(key => !["currentPassword", "newPassword", "confirmPassword"].includes(key))) throw new AuthError("Unexpected password fields.");
      const current = text(body, "currentPassword", 1024);
      const password = newPassword(text(body, "newPassword"));
      if (password !== text(body, "confirmPassword")) throw new AuthError("Password and confirmation do not match.");
      await service.changePassword(user.id, current, password);
      const response = NextResponse.json({ success: true, signInRequired: true });
      clearSessionCookie(response);
      return response;
    }
    const body = await authJson(req);
    const allowed = action === "login" ? ["email", "password"] : action === "register" ? ["email", "password", "name"] : action === "forgot" ? ["email"] : action === "reset" ? ["token", "password", "confirmPassword"] : ["token"];
    if (Object.keys(body).some(key => !allowed.includes(key))) throw new AuthError("Unexpected authentication fields.");
    if (["login", "register", "forgot"].includes(action)) {
      const email = emailAddress(body);
      await authLimit(req, action, email, false);
      if (action === "login") return NextResponse.json(await service.login(email, text(body, "password", 1024)));
      if (action === "register") {
        const password = newPassword(text(body, "password"));
        const name = body.name === undefined ? "" : text(body, "name", 200).trim();
        await emailLimit(email); // same admission for existing and unknown accounts
        const id = await service.register(email, name, password);
        if (id) queueEmail(await service.issueEmail(id, "verify"));
        return NextResponse.json({ message: registrationMessage }, { status: 202 });
      }
      await emailLimit(email);
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) queueEmail(await service.issueEmail(user.id, "reset"));
      return NextResponse.json({ message: resetMessage }, { status: 202 });
    }
    const token = tokenValue(body);
    await authLimit(req, action, service.hashToken(token), false);
    const password = action === "reset" ? newPassword(text(body, "password")) : undefined;
    if (password !== undefined && password !== text(body, "confirmPassword")) throw new AuthError("Password and confirmation do not match.");
    await service.consumeToken(token, password);
    const response = NextResponse.json({ success: true, message: action === "reset" ? "Password has been reset. You can now sign in." : "Email verified successfully." });
    if (action === "reset") clearSessionCookie(response);
    return response;
  } catch (error) { return authFailure(error); }
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set("orthodoxai_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(0) });
}
