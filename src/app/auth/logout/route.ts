import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("__demo_session");
  return response;
}
