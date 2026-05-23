# Coding Conventions

**Analysis Date:** 2026-05-23

## Naming Patterns

**Files:**
- Use Next App Router reserved filenames inside `src/app/`, including `page.tsx`, `layout.tsx`, `error.tsx`, and `route.ts`.
- Use lowercase kebab-case for reusable component and utility filenames, for example `src/components/inbox/conversation-thread.tsx`, `src/components/ui/section-label.tsx`, and `src/lib/active-client.ts`.
- Use `use-*.ts` for hooks, as in `src/hooks/use-conversations.ts` and `src/hooks/use-realtime.ts`.
- Keep shared domain types consolidated in `src/types/index.ts`.

**Functions:**
- Use PascalCase for React components such as `DashboardPage` in `src/app/(dashboard)/dashboard/page.tsx` and `Sidebar` in `src/components/ui/sidebar.tsx`.
- Use camelCase for helpers such as `getMessagePreview`, `parseNullableString`, `getSafeErrorMessage`, and `buildFallbackMessages`.
- Name server actions with an `Action` suffix, for example `saveSettingsAction` in `src/app/(dashboard)/settings/page.tsx`, `createAgentAction` in `src/app/(dashboard)/agents/page.tsx`, and `disconnectChannelAction` in `src/app/(dashboard)/channels/page.tsx`.
- Prefix data loaders with `load`, for example `loadClientContext`, `loadLead`, `loadKnowledgeBase`, and `loadInboxData`.

**Variables:**
- Use camelCase for local state and query results, such as `selectedLead`, `recentMessages`, `routingThreshold`, and `usagePercent`.
- Use `SCREAMING_SNAKE_CASE` for constants, such as `POLL_INTERVAL_MS` in `src/hooks/use-conversations.ts`, `NAV_ITEMS` in `src/components/ui/sidebar.tsx`, and `DEFAULT_CONFIG` in `src/lib/config.ts`.
- Name lookup tables with `*Styles`, `*Options`, `*Schema`, or `*Map`, such as `statusStyles`, `LANGUAGE_OPTIONS`, `followUpRequestSchema`, and `channelMap`.

**Types:**
- Use PascalCase for interfaces and type aliases, for example `ProcessMessageArgs` in `src/app/api/message/route.ts`, `SidebarProps` in `src/components/ui/sidebar.tsx`, and `ClientConfig` in `src/types/index.ts`.
- Use `*Props` for component props, `*Row` for shaped query rows, and `*Args` or `*Options` for helper arguments.

## Code Style

**Formatting:**
- No Prettier or Biome config is present at repo root. Formatting is driven by TypeScript strictness plus the style already established in `src/`.
- Follow the existing style from `src/app/layout.tsx`, `src/app/api/send/route.ts`, and `src/hooks/use-realtime.ts`: double quotes, semicolons, trailing commas, and multi-line wrapping for long object literals, imports, and JSX.
- Keep indentation at two spaces and prefer early returns over nested `else` branches.
- Put `"use client"` or `"server-only"` as the first statement in files that require a hard client or server boundary, as in `src/hooks/use-realtime.ts`, `src/app/error.tsx`, `src/lib/active-client.ts`, and `src/lib/supabase/server.ts`.

**Linting:**
- Use the ESLint flat config in `eslint.config.mjs`.
- The config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- Only `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` are globally ignored in `eslint.config.mjs`.
- `package.json` defines `npm run lint` as `eslint`, so lint currently scans the repo root rather than only `src/`.
- A direct lint run against the current tree reports warnings in `src/lib/normalise.ts` and `.agents/skills/clerk-tanstack-patterns/templates/tanstack-basic-auth/src/routes/__root.tsx`; keep the broad lint scope in mind when adding non-app files.

## Import Organization

**Order:**
1. Framework and third-party imports first, for example `next/cache`, `zod`, `@clerk/nextjs/server`, or `react`.
2. Internal `@/` imports second.
3. Type-only imports stay explicit with `import type`, usually after value imports from the same area, as in `src/app/api/send/route.ts`, `src/app/(dashboard)/dashboard/page.tsx`, and `src/components/inbox/inbox-shell.tsx`.

**Path Aliases:**
- Use the `@/*` alias from `tsconfig.json` for all imports under `src/`.
- Avoid deep relative imports inside `src/`; current code consistently prefers `@/components/...`, `@/lib/...`, `@/hooks/...`, and `@/types`.

## Route Patterns

**App Router:**
- Put UI routes under `src/app/` and use route groups to separate flows, for example `src/app/(auth)/...` and `src/app/(dashboard)/...`.
- Use dynamic segments for entity-specific pages, such as `src/app/(dashboard)/leads/[id]/page.tsx` and `src/app/(dashboard)/inbox/[leadId]/page.tsx`.
- Keep page components server-rendered by default. Only mark a file `"use client"` when it owns browser state, effects, or event handlers.

**Protected Routes:**
- Update `src/middleware.ts` whenever a new dashboard page or protected API endpoint is added.
- Protected UI routes and APIs are enumerated explicitly in `createRouteMatcher`, not inferred automatically.

**API Routes:**
- Put JSON endpoints under `src/app/api/**/route.ts` and export uppercase HTTP methods such as `GET`, `POST`, and `PATCH`.
- Return `Response.json(...)` in most routes. `NextResponse` is used only in the redirect callback route `src/app/auth/callback/route.ts` and the placeholder `src/app/api/broadcast/route.ts`.
- Delegate repeated webhook behavior into shared libraries when possible, as in `src/lib/meta-webhook.ts`.

**Server Actions:**
- Co-locate server actions inside the page that renders the form. Current CRUD pages do this in `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`, and `src/app/(dashboard)/settings/page.tsx`.
- Start each server action with `"use server"`, validate `FormData`, perform inline Supabase writes, and finish with `revalidatePath(...)`.

Example pattern from `src/app/(dashboard)/settings/page.tsx`:

```ts
async function saveSettingsAction(formData: FormData) {
  "use server";

  const payload = settingsSchema.safeParse({
    businessName: formData.get("business_name"),
    model: formData.get("model"),
  });

  if (!payload.success) {
    return;
  }

  // write to Supabase, then refresh the route
  revalidatePath("/settings");
}
```

## UI Patterns

**Composition:**
- Keep shared primitives minimal and style-focused in `src/components/ui/`, for example `src/components/ui/card.tsx`, `src/components/ui/section-label.tsx`, and `src/components/ui/button.ts`.
- Build feature UIs from those primitives inside feature folders such as `src/components/inbox/`, `src/components/leads/`, and `src/components/channels/`.
- Let `src/app/(dashboard)/*/page.tsx` own page-specific layout, copy, and form markup instead of pushing everything into reusable components.

**Styling:**
- Use inline Tailwind utility strings rather than CSS modules or styled components.
- Reuse the palette and font tokens defined in `tailwind.config.ts` and wired through `src/app/layout.tsx`.
- Match the existing dashboard shell pattern from `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/agents/page.tsx`, and `src/app/(dashboard)/settings/page.tsx`: `flex flex-col gap-6 p-8 sm:p-10`.
- Reuse helper functions for repeated class strings inside a page, such as `getInputClassName`, `getTextareaClassName`, `getStatusClassName`, and `getNavClassName`.
- Keep global CSS minimal. `src/app/globals.css` only sets Tailwind config import plus base `html` and `body` styles.

**Typography and Labels:**
- Use `font-display` for large uppercase titles, `font-body` for body copy and form controls, and `font-mono` for small system labels and counters.
- Use `SectionLabel` from `src/components/ui/section-label.tsx` for small uppercase section headers instead of hand-rolling the same class string.

## Data Access Conventions

**Server-side Supabase:**
- Use `createServiceRoleClient()` from `src/lib/supabase/server.ts` for privileged server work in routes and background utilities such as `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/lib/meta-webhook.ts`, `src/lib/notify.ts`, and `src/lib/queue.ts`.
- Use `getActiveClientContext()` from `src/lib/active-client.ts` when a server component, server action, or protected route needs the Clerk-authenticated client plus a Supabase client.
- Keep Supabase queries inline near the consuming logic. There is no repository or ORM layer in the current codebase.

**Browser-side Supabase:**
- Use `createClient()` from `src/lib/supabase/client.ts` only in client hooks that need realtime subscriptions, as in `src/hooks/use-realtime.ts`.

**Result Shaping:**
- Define narrow `*Row` types next to the query that uses them, for example `ChannelRow` in `src/app/(dashboard)/channels/page.tsx`, `ConversationLeadRow` in `src/app/(dashboard)/inbox/_data.ts`, and `RecentLeadRow` in `src/app/(dashboard)/dashboard/page.tsx`.
- Cast Supabase results once near the query result and then work with the narrowed type, for example `(data ?? []) as ChannelRow[]`.
- Sanitize persisted JSON config through `getClientConfig()` in `src/lib/config.ts` before reading nested fields.

## Validation and Error Handling

**Validation:**
- Validate request bodies and form submissions at the edge of the module with `zod.safeParse(...)`.
- Use schemas near the route or page that consumes them, as in `src/app/api/send/route.ts`, `src/app/api/followup/route.ts`, `src/app/api/ai-control/route.ts`, and `src/app/(dashboard)/agents/page.tsx`.
- Use small parsing helpers for non-JSON form details, for example `parseBooleanField`, `parseNullableString`, `parseTerritories`, and `parseQuestions`.
- Use manual runtime guards when `zod` would be awkward for hot-path realtime payload parsing, as in `src/hooks/use-realtime.ts` and `src/lib/config.ts`.

Example API boundary pattern from `src/app/api/send/route.ts`:

```ts
const body = sendMessageSchema.safeParse((await request.json()) as unknown);

if (!body.success) {
  return Response.json({ error: "Invalid request body" }, { status: 400 });
}
```

**Error Handling:**
- Throw `new Error(...)` from helper functions when a Supabase call or required environment variable fails, as in `src/lib/supabase/server.ts`, `src/lib/active-client.ts`, and `src/app/api/send/route.ts`.
- Catch at the route boundary and translate failures into HTTP responses for interactive APIs such as `src/app/api/send/route.ts`, `src/app/api/ai-control/route.ts`, and `src/app/api/followup/route.ts`.
- In server actions, invalid `safeParse` results usually `return` silently instead of surfacing a structured validation error.
- In webhook and background-style endpoints, prefer logging and returning `{ ok: true }` even when downstream processing fails. This pattern is deliberate in `src/app/api/message/route.ts` and `src/lib/meta-webhook.ts`.

## Logging

**Framework:** console

**Patterns:**
- Use `console.error(...)` for operational failures throughout `src/app/api/`, `src/lib/meta-webhook.ts`, `src/lib/notify.ts`, and the error boundaries in `src/app/error.tsx` and `src/app/(dashboard)/error.tsx`.
- Prefix log messages with a concise subsystem label, for example `Human reply failed: ...`, `Follow-up route failed: ...`, and `Lead scoring update failed: ...`.
- Reuse a local `getSafeErrorMessage(error: unknown)` helper when the module catches `unknown`, as in `src/app/api/send/route.ts`, `src/app/api/followup/route.ts`, `src/app/api/ai-control/route.ts`, and `src/lib/meta-webhook.ts`.

## Comments

**When to Comment:**
- Comments are sparse. Add one only when a framework caveat or non-obvious tradeoff exists.
- The existing model is the short explanatory comment in `src/lib/supabase/server.ts` describing why `cookieStore.set(...)` may fail in Server Components.

**JSDoc/TSDoc:**
- Not used in `src/`.
- Prefer clear type names and small helpers over block documentation comments.

## Function Design

**Size:** Split large workflows into small helpers above the exported entry point. `src/app/api/message/route.ts` and `src/app/api/followup/route.ts` are the dominant examples.

**Parameters:**
- Pass structured `Args` objects into complex helpers, for example `processMessage({ lead, channel, normalised, supabase })` in `src/app/api/message/route.ts`.
- For Supabase helper functions, type the client explicitly with `type ServiceRoleClient = SupabaseClient` or `Awaited<ReturnType<typeof getActiveClientContext>>["supabase"]`.

**Return Values:**
- Use explicit nullable returns for query helpers such as `Promise<Lead | null>`, `Promise<Channel | null>`, and `Promise<Client | null>`.
- Return `Promise<Response>` or `Response` from route handlers.
- Return plain objects from server-side data loaders such as `loadInboxData` in `src/app/(dashboard)/inbox/_data.ts`.

## Module Design

**Exports:**
- Export a single default page component from `src/app/**/page.tsx`.
- Export named helpers from library modules, for example `getClientConfig` in `src/lib/config.ts`, `sendViaChannel` in `src/lib/channels/index.ts`, and `useRealtimeMessages` in `src/hooks/use-realtime.ts`.
- Some UI modules export both named and default variants for convenience, as in `src/components/ui/card.tsx`, `src/components/ui/section-label.tsx`, `src/components/ui/sidebar.tsx`, and `src/components/inbox/inbox-shell.tsx`.

**Barrel Files:**
- Avoid broad barrel files. The only current dispatcher-style entry point is `src/lib/channels/index.ts`, which routes by `Platform`.
- Keep most modules self-contained and import them directly by file path.

---

*Convention analysis: 2026-05-23*
