import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "orthodoxai_session";

const protectedRoutes = [
  "/dashboard",
  "/account",
  "/settings",
  "/onboarding",
  "/today",
  "/chat",
  "/prayers",
  "/fasting",
  "/scripture",
  "/confession",
  "/journal",
  "/history",
  "/pro",
  
];

const authRoutes = ["/login", "/register"];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isAuthRoute(pathname: string) {
  return authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (isProtectedRoute(pathname) && !sessionToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute(pathname) && sessionToken) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/today/:path*",
    "/chat/:path*",
    "/prayers/:path*",
    "/fasting/:path*",
    "/scripture/:path*",
    "/confession/:path*",
    "/journal/:path*",
    "/history/:path*",
    "/pro/:path*",
    "/login",
    "/register",
  ],
};