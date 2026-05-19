import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const token = formData.get("token");
  const next = formData.get("next");
  const redirectTo = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";
  const expected = process.env.DEMO_LOGIN_TOKEN;

  if (!expected || typeof token !== "string" || token !== expected) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set("__demo_session", expected, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function GET(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
