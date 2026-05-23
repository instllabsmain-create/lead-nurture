# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```text
[project-root]/
├── src/app/                 # Next.js App Router pages, layouts, route handlers, and inline server actions
├── src/components/          # Shared UI and feature-specific client/presentational components
├── src/hooks/               # Browser hooks for inbox polling and Supabase realtime subscriptions
├── src/lib/                 # Server/domain helpers and third-party integration adapters
├── src/types/               # Shared domain type definitions
├── supabase/                # Local Supabase config and SQL migrations
├── public/                  # Static assets served as-is
├── .planning/codebase/      # Generated mapper reference docs
├── package.json             # Scripts and dependency manifest
└── TESTING.md               # Project-local testing notes; no automated test directory detected
```

## Directory Purposes

**`src/app`:**
- Purpose: Own the route tree and all request entry points.
- Contains: `page.tsx`, `layout.tsx`, `error.tsx`, route groups like `src/app/(dashboard)`, and HTTP handlers under `src/app/api`.
- Key files: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/api/message/route.ts`

**`src/app/(auth)`:**
- Purpose: Public auth screens handled by Clerk components.
- Contains: `src/app/(auth)/login/[[...login]]/page.tsx` and `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Key files: `src/app/(auth)/login/[[...login]]/page.tsx`, `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**`src/app/(dashboard)`:**
- Purpose: Authenticated back-office UI for leads, inbox, agents, channels, knowledge, settings, and placeholder screens.
- Contains: Server-rendered page modules, feature-local server actions, the shared dashboard layout, and private helpers like `src/app/(dashboard)/inbox/_data.ts`.
- Key files: `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/inbox/page.tsx`, `src/app/(dashboard)/leads/page.tsx`, `src/app/(dashboard)/settings/page.tsx`

**`src/app/api`:**
- Purpose: Handle browser mutations, webhook ingestion, and background callbacks.
- Contains: Authenticated JSON APIs (`src/app/api/send/route.ts`, `src/app/api/ai-control/route.ts`, `src/app/api/inbox/route.ts`), pipeline endpoints (`src/app/api/message/route.ts`, `src/app/api/followup/route.ts`), and provider webhooks under `src/app/api/webhook`.
- Key files: `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/app/api/webhook/website/route.ts`

**`src/components`:**
- Purpose: House reusable view code outside the App Router layer.
- Contains: Feature folders `src/components/inbox`, `src/components/leads`, `src/components/channels`, `src/components/dashboard`, plus shared primitives in `src/components/ui`.
- Key files: `src/components/inbox/inbox-shell.tsx`, `src/components/inbox/message-input.tsx`, `src/components/ui/sidebar.tsx`, `src/components/leads/lead-detail.tsx`

**`src/hooks`:**
- Purpose: Isolate browser-side data refresh and subscription logic.
- Contains: `src/hooks/use-conversations.ts` for active inbox polling and `src/hooks/use-realtime.ts` for Supabase subscription hooks.
- Key files: `src/hooks/use-conversations.ts`, `src/hooks/use-realtime.ts`

**`src/lib`:**
- Purpose: Hold non-visual business logic and integration glue.
- Contains: Tenant resolution in `src/lib/active-client.ts`, config and scoring logic, AI integration, queueing, notifications, webhook adapters, and channel senders.
- Key files: `src/lib/active-client.ts`, `src/lib/config.ts`, `src/lib/ai.ts`, `src/lib/queue.ts`, `src/lib/channels/index.ts`

**`src/lib/channels`:**
- Purpose: Separate outbound platform implementations by channel.
- Contains: One file per transport plus the dispatcher in `src/lib/channels/index.ts`.
- Key files: `src/lib/channels/whatsapp.ts`, `src/lib/channels/facebook.ts`, `src/lib/channels/instagram.ts`, `src/lib/channels/website.ts`

**`src/lib/supabase`:**
- Purpose: Construct Supabase clients for server and browser contexts.
- Contains: `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts`
- Key files: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`

**`src/types`:**
- Purpose: Define the shared application data model used by pages, components, and services.
- Contains: One central file, `src/types/index.ts`
- Key files: `src/types/index.ts`

**`supabase`:**
- Purpose: Keep schema and local Supabase project metadata close to the app.
- Contains: SQL migrations in `supabase/migrations`, local config in `supabase/config.toml`, and setup helpers like `supabase/setup.sql`.
- Key files: `supabase/migrations/20240101000000_initial_schema.sql`, `supabase/migrations/20240104000000_leads_ai_paused.sql`, `supabase/migrations/20240105000000_clients_clerk_user_id.sql`

**`public`:**
- Purpose: Static browser assets.
- Contains: Template SVG assets such as `public/next.svg`, `public/vercel.svg`, and `public/window.svg`
- Key files: `public/next.svg`, `public/vercel.svg`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML/body shell and Clerk provider.
- `src/app/page.tsx`: Redirect from `/` to `/dashboard`.
- `src/app/(dashboard)/layout.tsx`: Shared authenticated dashboard shell.
- `src/middleware.ts`: Route protection for dashboard and selected API paths.
- `src/app/api/message/route.ts`: Central inbound messaging pipeline.

**Configuration:**
- `package.json`: NPM scripts and package dependencies.
- `tsconfig.json`: TypeScript options and the `@/*` path alias.
- `next.config.ts`: Exposes Supabase public env vars to Next.js.
- `tailwind.config.ts`: Tailwind token/config entry point.
- `eslint.config.mjs`: ESLint setup for the codebase.
- `supabase/config.toml`: Local Supabase project configuration.
- `vercel.json`: Deployment-related config.

**Core Logic:**
- `src/lib/active-client.ts`: Clerk-to-client resolution and default client bootstrap.
- `src/lib/config.ts`: Normalize `clients.config`.
- `src/lib/score.ts`: Lead scoring rules.
- `src/lib/assign.ts`: Agent assignment rules.
- `src/lib/queue.ts`: Follow-up scheduling via QStash.
- `src/lib/notify.ts`: Agent/client notification dispatch.
- `src/lib/meta-webhook.ts`: Meta signature verification and forwarding.
- `src/lib/normalise.ts`: Channel payload normalization.

**Testing:**
- `TESTING.md`: Manual testing guidance/documentation.
- `package.json`: No test script is defined here.
- Not detected: `__tests__/`, `*.test.ts`, `*.spec.ts`, `jest.config.*`, `vitest.config.*`

## Naming Conventions

**Files:**
- Use Next.js reserved route filenames inside `src/app`: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`.
- Use lowercase kebab-case for feature modules and components outside reserved route files: `src/components/leads/lead-detail.tsx`, `src/lib/active-client.ts`, `src/lib/meta-webhook.ts`.
- Use a leading underscore for route-private helpers that should stay near one segment: `src/app/(dashboard)/inbox/_data.ts`.

**Directories:**
- Use route groups in parentheses for non-URL structural splits: `src/app/(auth)`, `src/app/(dashboard)`.
- Use bracketed folders for dynamic segments: `src/app/(dashboard)/inbox/[leadId]`, `src/app/(dashboard)/leads/[id]`.
- Use top-level feature folders under `src/components` that mirror product areas: `inbox`, `leads`, `channels`, `dashboard`, `ui`.

## Where to Add New Code

**New Feature:**
- Primary code: Add the route in `src/app/(dashboard)/<feature>/page.tsx` if it is an authenticated dashboard screen, or in `src/app/(auth)/<feature>/page.tsx` if it is public auth-facing UI.
- Tests: Add documentation or future tests next to the feature once a test harness exists. Today, the only testing artifact is `TESTING.md`.

**New API Endpoint:**
- Implementation: `src/app/api/<endpoint>/route.ts`
- Shared business logic: `src/lib/<domain>.ts` or `src/lib/<subdomain>/<module>.ts`
- Webhook adapters: `src/app/api/webhook/<provider>/route.ts` plus normalization logic in `src/lib/normalise.ts`

**New Component/Module:**
- Feature-specific UI: `src/components/<feature>/`
- Shared primitive UI: `src/components/ui/`
- Browser-only data hooks: `src/hooks/`
- Shared types: extend `src/types/index.ts`

**Utilities:**
- Shared helpers: `src/lib/`
- Supabase client helpers: `src/lib/supabase/`
- Channel transport adapters: `src/lib/channels/`

**Database Changes:**
- Schema migration: `supabase/migrations/<timestamp>_<description>.sql`
- Type alignment: update `src/types/index.ts` when schema changes affect runtime objects used in app code.

## Special Directories

**`.planning/codebase`:**
- Purpose: Stores generated architecture/stack/quality/concern reference docs.
- Generated: Yes
- Committed: Intended to be committed as project planning artifacts.

**`.next`:**
- Purpose: Local Next.js build output.
- Generated: Yes
- Committed: No, ignored by `.gitignore`

**`node_modules`:**
- Purpose: Installed package dependencies.
- Generated: Yes
- Committed: No, ignored by `.gitignore`

**`.vercel`:**
- Purpose: Local Vercel project metadata.
- Generated: Yes
- Committed: No, ignored by `.gitignore`

**`supabase/.temp`:**
- Purpose: Local Supabase CLI scratch state.
- Generated: Yes
- Committed: Not intended for source edits

---

*Structure analysis: 2026-05-23*
