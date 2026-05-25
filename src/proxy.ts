import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/inbox(.*)",
  "/leads(.*)",
  "/agents(.*)",
  "/channels(.*)",
  "/settings(.*)",
  "/broadcasts(.*)",
  "/knowledge(.*)",
  "/onboarding(.*)",
  "/api/inbox(.*)",
  "/api/send(.*)",
  "/api/ai-control(.*)",
  "/api/broadcast(.*)",
]);

const DEMO_SUBDOMAIN = (
  process.env.NEXT_PUBLIC_DEMO_SUBDOMAIN?.trim().toLowerCase()
  || "demo"
);

function getRequestHostname(request: Request): string {
  return (
    request.headers.get("x-forwarded-host")
    ?? request.headers.get("host")
    ?? ""
  )
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function isDemoSubdomainHost(hostname: string): boolean {
  return hostname.startsWith(`${DEMO_SUBDOMAIN}.`);
}

export default clerkMiddleware(async (auth, request) => {
  if (isDemoSubdomainHost(getRequestHostname(request)) && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/demo-site";
    return NextResponse.rewrite(url);
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
