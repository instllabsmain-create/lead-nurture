import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALWAYS_PUBLIC_PREFIXES = [
  "/login",
  "/auth/",
  "/_next/",
  "/favicon.ico",
  "/api/webhook/",
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/leads",
  "/agents",
  "/channels",
  "/settings",
  "/broadcasts",
  "/knowledge",
  "/onboarding",
];

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isAlwaysPublic(pathname)) {
    return supabaseResponse;
  }

  if (isProtected(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
