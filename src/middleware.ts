import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/leads",
  "/agents",
  "/channels",
  "/settings",
  "/knowledge-base",
];

const ALWAYS_PUBLIC_PREFIXES = [
  "/api/webhook",
  "/api/message",
  "/api/followup",
  "/auth",
  "/_next",
  "/favicon",
];

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isAlwaysPublic(pathname)) {
    return NextResponse.next();
  }

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.DEMO_LOGIN_TOKEN;
  const session = request.cookies.get("__demo_session")?.value;

  if (!expected || session !== expected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
