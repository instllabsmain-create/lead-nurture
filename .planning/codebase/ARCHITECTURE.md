# Architecture

**Analysis Date:** 2026-05-23

## Pattern Overview

**Overall:** Next.js App Router monolith with a server-rendered dashboard, colocated server actions, and internal API routes for asynchronous messaging workflows.

**Key Characteristics:**
- `src/app` is the primary boundary: route groups under `src/app/(auth)` and `src/app/(dashboard)` hold pages, while `src/app/api` holds all HTTP endpoints.
- Authenticated UI reads and mutations run on the server by resolving a tenant-aware client context through `src/lib/active-client.ts`.
- External message ingestion is normalized at webhook edges and forwarded into one internal pipeline at `src/app/api/message/route.ts`.

## Layers

**Routing and Application Shell:**
- Purpose: Define top-level layouts, route groups, redirects, and route protection.
- Location: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/middleware.ts`
- Contains: Root font/theme setup, `ClerkProvider`, dashboard chrome, protected-route middleware, auth pages, error boundaries.
- Depends on: `@clerk/nextjs`, `next/navigation`, `@/components/ui/sidebar`, `@/lib/active-client`
- Used by: Every page and API request entering the app.

**Feature Pages and Server Actions:**
- Purpose: Render dashboard screens and own feature-local write operations.
- Location: `src/app/(dashboard)/*/page.tsx`
- Contains: Supabase reads, local data shaping, and inline `"use server"` actions for forms in `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`, and `src/app/(dashboard)/settings/page.tsx`.
- Depends on: `@/lib/active-client`, `@/lib/config`, feature components under `src/components`
- Used by: Dashboard routes such as `/dashboard`, `/leads`, `/agents`, `/channels`, `/knowledge`, `/settings`.

**Interactive Client Layer:**
- Purpose: Handle browser-only state and interaction after the server has rendered the initial screen.
- Location: `src/components/inbox/*`, `src/components/channels/copy-button.tsx`, `src/hooks/*`, `src/components/ui/sidebar.tsx`
- Contains: `InboxShell` polling behavior, message composer, conversation list/thread UI, clipboard copy, pathname-aware sidebar state.
- Depends on: Browser `fetch`, React state/effects, `src/app/api/inbox/route.ts`, `src/app/api/send/route.ts`, `src/app/api/ai-control/route.ts`
- Used by: Inbox pages under `src/app/(dashboard)/inbox/*` and smaller interactive controls embedded in server-rendered pages.

**Domain and Integration Services:**
- Purpose: Centralize cross-route business logic and third-party integrations.
- Location: `src/lib/*`
- Contains: Tenant resolution in `src/lib/active-client.ts`, AI prompt/reply generation in `src/lib/prompts.ts` and `src/lib/ai.ts`, scoring in `src/lib/score.ts`, assignment in `src/lib/assign.ts`, notifications in `src/lib/notify.ts`, transport dispatch in `src/lib/channels/index.ts`, webhook verification/normalization in `src/lib/meta-webhook.ts` and `src/lib/normalise.ts`, and deferred jobs in `src/lib/queue.ts`.
- Depends on: Supabase, Clerk server auth, OpenRouter, Upstash QStash, Resend, platform HTTP APIs.
- Used by: API routes under `src/app/api/*` and dashboard pages that need shared config parsing.

**Persistence and Schema Layer:**
- Purpose: Define data model and create Supabase clients.
- Location: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/types/index.ts`, `supabase/migrations/*.sql`
- Contains: Service-role and browser Supabase client factories, shared domain types, schema DDL for `clients`, `channels`, `agents`, `leads`, `messages`, `knowledge_base`, `follow_ups`, and `broadcasts`.
- Depends on: Environment variables and Supabase platform features.
- Used by: Every server page and route handler that touches persistent state.

## Data Flow

**Authenticated Dashboard Render:**

1. `src/middleware.ts` protects dashboard and selected API paths with Clerk.
2. A page or layout such as `src/app/(dashboard)/layout.tsx` or `src/app/(dashboard)/dashboard/page.tsx` calls `getActiveClientContext()` from `src/lib/active-client.ts`.
3. `getActiveClientContext()` maps the Clerk user to a `clients` row and returns a service-role Supabase client plus the active tenant record.
4. The page queries tenant-scoped rows directly from Supabase, shapes them into view models, and returns server-rendered JSX.

**Inbox Hydration and Refresh:**

1. `src/app/(dashboard)/inbox/page.tsx` or `src/app/(dashboard)/inbox/[leadId]/page.tsx` loads the initial snapshot through `src/app/(dashboard)/inbox/_data.ts`.
2. `_data.ts` fetches leads, recent messages, and channels, then derives conversation previews and the selected thread.
3. `src/components/inbox/inbox-shell.tsx` receives the server snapshot and mounts the client hook in `src/hooks/use-conversations.ts`.
4. `useConversations()` polls `src/app/api/inbox/route.ts` every 5 seconds and replaces local React state with the refreshed server snapshot.

**Inbound Message Pipeline:**

1. Platform-specific webhook routes in `src/app/api/webhook/facebook/route.ts`, `src/app/api/webhook/instagram/route.ts`, `src/app/api/webhook/whatsapp/route.ts`, and `src/app/api/webhook/website/route.ts` validate the request and normalize payloads.
2. `src/lib/meta-webhook.ts` and `src/lib/normalise.ts` convert external payloads into the shared `NormalisedMessage` shape from `src/types/index.ts`.
3. Webhook handlers forward normalized payloads to `src/app/api/message/route.ts`.
4. `src/app/api/message/route.ts` upserts the lead, inserts the inbound message, and defers `processMessage()` with `waitUntil()`.
5. `processMessage()` loads context, optionally generates an AI reply, updates lead score/status, assigns or notifies humans, and schedules a follow-up job.

**Human Reply and Scheduled Follow-up:**

1. `src/components/inbox/message-input.tsx` posts manual replies to `src/app/api/send/route.ts`.
2. `src/app/api/send/route.ts` resolves the active tenant, loads the lead and channel, sends through `src/lib/channels/index.ts`, persists the outbound message, and updates `leads.last_active`.
3. `src/lib/queue.ts` stores follow-up rows and publishes delayed jobs to `/api/followup`.
4. `src/app/api/followup/route.ts` verifies the QStash signature, skips stale or duplicate sends, dispatches the message through the same channel abstraction, and marks the follow-up as sent.

**State Management:**
- Persistent state lives in Supabase tables declared in `supabase/migrations/20240101000000_initial_schema.sql`.
- Authenticated server rendering is the default read path; most pages do not keep long-lived client caches.
- Client-side UI state is local React state in `src/hooks/use-conversations.ts` and small component-level `useState` usage under `src/components`.
- Polling is the active inbox freshness mechanism. `src/hooks/use-realtime.ts` contains Supabase realtime subscription hooks, but no current route or component imports them.

## Key Abstractions

**Active Client Context:**
- Purpose: Resolve the current Clerk user into one tenant/client record and return the Supabase handle used across the request.
- Examples: `src/lib/active-client.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/api/send/route.ts`
- Pattern: Server-only request context helper. Use this for authenticated dashboard pages and authenticated API routes instead of repeating Clerk-to-client lookup logic.

**Client Config Normalization:**
- Purpose: Turn `clients.config` JSON into a predictable shape with defaults for routing, scoring, and AI behavior.
- Examples: `src/lib/config.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/lib/score.ts`, `src/lib/prompts.ts`
- Pattern: Parse once at the edge of business logic and pass normalized values downstream.

**Normalized Message Envelope:**
- Purpose: Give Meta and website payloads one common format before they enter the lead-processing pipeline.
- Examples: `src/types/index.ts`, `src/lib/normalise.ts`, `src/lib/meta-webhook.ts`, `src/app/api/message/route.ts`
- Pattern: Adapter layer. New channel integrations should normalize into this shape before reusing the core pipeline.

**Channel Transport Dispatcher:**
- Purpose: Hide platform-specific send logic behind one `sendViaChannel()` call.
- Examples: `src/lib/channels/index.ts`, `src/lib/channels/whatsapp.ts`, `src/lib/channels/facebook.ts`, `src/lib/channels/instagram.ts`, `src/lib/channels/website.ts`
- Pattern: Small dispatcher with one module per channel transport.

**Inbox Snapshot Loader:**
- Purpose: Keep server page render and polled inbox API responses consistent by sharing one loader.
- Examples: `src/app/(dashboard)/inbox/_data.ts`, `src/app/(dashboard)/inbox/page.tsx`, `src/app/api/inbox/route.ts`
- Pattern: Private server-side data module colocated with a route segment and reused by both UI and API entry points.

## Entry Points

**Root App Shell:**
- Location: `src/app/layout.tsx`
- Triggers: Every page render.
- Responsibilities: Apply global fonts/styles and initialize Clerk across the application.

**Dashboard Shell:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: Every dashboard route render.
- Responsibilities: Resolve tenant context, query sidebar counters, and wrap pages with the persistent sidebar layout.

**Default Redirect:**
- Location: `src/app/page.tsx`
- Triggers: Requests to `/`.
- Responsibilities: Redirect unaffiliated root traffic into `/dashboard`.

**Inbound Processing Endpoint:**
- Location: `src/app/api/message/route.ts`
- Triggers: Internal forwards from webhook routes.
- Responsibilities: Persist inbound messages, create/update leads, and fan out into AI, scoring, assignment, notification, and follow-up work.

**Manual Send Endpoint:**
- Location: `src/app/api/send/route.ts`
- Triggers: Browser sends from `src/components/inbox/message-input.tsx`.
- Responsibilities: Authorize the tenant, deliver the outbound message, save it, and bump lead activity.

**Scheduled Follow-up Endpoint:**
- Location: `src/app/api/followup/route.ts`
- Triggers: Delayed QStash delivery from `src/lib/queue.ts`.
- Responsibilities: Verify signatures, suppress duplicates or stale jobs, send follow-ups, and mark rows as sent.

**Webhook Edges:**
- Location: `src/app/api/webhook/*/route.ts`
- Triggers: Meta and website callbacks.
- Responsibilities: Verify provider authenticity, normalize payloads, and forward them into the internal `/api/message` contract.

## Error Handling

**Strategy:** Handle errors locally at route/page boundaries, log with `console.error`, and keep asynchronous ingestion endpoints resilient by returning success-like responses unless verification fails.

**Patterns:**
- Authenticated JSON routes such as `src/app/api/send/route.ts` and `src/app/api/ai-control/route.ts` validate inputs with `zod` and return explicit `400`, `403`, `404`, or `500` responses.
- Webhook-style routes such as `src/app/api/message/route.ts` and `src/lib/meta-webhook.ts` log failures and often return `{ ok: true }` to avoid provider retry storms after application-level errors.
- Server actions inside page files throw on failed Supabase writes and rely on the route segment error boundary in `src/app/(dashboard)/error.tsx` or the global boundary in `src/app/error.tsx`.

## Cross-Cutting Concerns

**Logging:** `console.error` is the only logging mechanism detected across `src/app/api/*` and `src/lib/*`.
**Validation:** Use `zod` at request/form boundaries and hand-written guards in `src/lib/config.ts` and `src/lib/normalise.ts`.
**Authentication:** Clerk middleware in `src/middleware.ts` protects routes, while `src/lib/active-client.ts` enforces authenticated tenant resolution on the server.

---

*Architecture analysis: 2026-05-23*
