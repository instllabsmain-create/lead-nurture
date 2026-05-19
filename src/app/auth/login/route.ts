import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const next = formData.get("next");
  const redirectTo =
    typeof next === "string" && next.startsWith("/") ? next : "/dashboard";

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}

export function GET(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
