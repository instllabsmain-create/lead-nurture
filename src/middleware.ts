import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function getRequiredEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function buildRedirectResponse(url: URL, response: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "location") {
      redirectResponse.headers.set(key, value);
    }
  });

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildRedirectResponse(new URL("/login", request.url), response);
  }

  const { data: client } = await supabase
    .from("clients")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  const pathname = request.nextUrl.pathname;
  const isOnboardingRoute = pathname === "/onboarding";

  if (!client?.onboarding_completed) {
    if (isOnboardingRoute) {
      return response;
    }

    return buildRedirectResponse(new URL("/onboarding", request.url), response);
  }

  if (isOnboardingRoute) {
    return buildRedirectResponse(new URL("/dashboard", request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inbox/:path*",
    "/leads/:path*",
    "/broadcasts/:path*",
    "/agents/:path*",
    "/channels/:path*",
    "/knowledge/:path*",
    "/settings/:path*",
    "/onboarding",
  ],
};
