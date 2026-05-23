# Technology Stack

**Analysis Date:** 2026-05-23

## Languages

**Primary:**
- TypeScript - application code lives in `src/app`, `src/components`, `src/hooks`, `src/lib`, and `src/types`.
- SQL - database schema and migrations live in `supabase/setup.sql` and `supabase/migrations/20240101000000_initial_schema.sql`, `supabase/migrations/20240104000000_leads_ai_paused.sql`, `supabase/migrations/20240105000000_clients_clerk_user_id.sql`.

**Secondary:**
- CSS - global styling is defined in `src/app/globals.css` and themed through `tailwind.config.ts`.
- JSON/TOML/MJS - repository configuration is split across `package.json`, `package-lock.json`, `tsconfig.json`, `vercel.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, and `supabase/config.toml`.

## Runtime

**Environment:**
- Node.js - required by `package.json` scripts (`next dev`, `next build`, `next start`, `eslint`), but the exact version is not pinned in repo config.
- Next.js server runtime - App Router pages in `src/app` and route handlers in `src/app/api/*/route.ts` run on the Next.js server layer.
- Vercel-compatible runtime helpers - `waitUntil` from `@vercel/functions` is used in `src/app/api/message/route.ts`, `src/app/api/webhook/website/route.ts`, and `src/lib/meta-webhook.ts`.

**Package Manager:**
- npm - `package-lock.json` is present with `lockfileVersion: 3`.
- Lockfile: present at `package-lock.json`.

## Frameworks

**Core:**
- Next.js 16.2.6 - the main framework declared in `package.json`, with App Router entry points in `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(dashboard)/layout.tsx`, and middleware in `src/middleware.ts`.
- React 19.2.4 - rendering layer for pages and components in `src/app/**/*.tsx` and `src/components/**/*.tsx`.
- Clerk 7.4.1 via `@clerk/nextjs` - authentication provider wired in `src/app/layout.tsx`, `src/middleware.ts`, `src/lib/active-client.ts`, `src/app/(auth)/login/[[...login]]/page.tsx`, and `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`.
- Supabase SSR 0.10.3 and Supabase JS 2.105.4 - browser, server, and service-role clients live in `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`.

**Testing:**
- Not detected - no `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`, `*.test.*`, or `*.spec.*` files were found in the repo.

**Build/Dev:**
- Tailwind CSS 4 - theme tokens and scan paths are configured in `tailwind.config.ts`.
- PostCSS with `@tailwindcss/postcss` - configured in `postcss.config.mjs`.
- TypeScript 5 - compiler settings and the `@/*` alias are configured in `tsconfig.json`.
- ESLint 9 with `eslint-config-next` - linting rules are configured in `eslint.config.mjs`.
- Supabase CLI local stack - local API, database, auth, storage, realtime, and Studio are configured in `supabase/config.toml`.

## Entry Points

**Application:**
- `src/app/page.tsx` - root entry that redirects to `/dashboard`.
- `src/app/layout.tsx` - root layout that loads fonts, global CSS, and `ClerkProvider`.
- `src/app/(dashboard)/layout.tsx` - authenticated dashboard shell that loads client-scoped counters from Supabase before rendering the sidebar.

**Middleware:**
- `src/middleware.ts` - protects dashboard and selected API routes with `clerkMiddleware`.

**API Routes:**
- `src/app/api/message/route.ts` - main inbound message pipeline: stores inbound messages, generates AI replies, scores leads, schedules follow-ups, and triggers notifications.
- `src/app/api/followup/route.ts` - signed QStash callback that sends delayed follow-up messages.
- `src/app/api/send/route.ts` - human outbound send endpoint.
- `src/app/api/ai-control/route.ts` - toggles `leads.ai_paused`.
- `src/app/api/inbox/route.ts` - returns inbox snapshot data.
- `src/app/api/broadcast/route.ts` - placeholder endpoint returning `501`.
- `src/app/api/webhook/whatsapp/route.ts`, `src/app/api/webhook/facebook/route.ts`, `src/app/api/webhook/instagram/route.ts`, `src/app/api/webhook/website/route.ts` - inbound webhook endpoints.
- `src/app/auth/callback/route.ts` - auth callback redirect target.

## Key Dependencies

**Critical:**
- `@clerk/nextjs` - identity, session protection, and hosted auth UI across `src/app/layout.tsx`, `src/middleware.ts`, and `src/lib/active-client.ts`.
- `@supabase/ssr` and `@supabase/supabase-js` - all persistent app data flows through `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, and the Supabase queries spread across `src/app` and `src/lib`.
- `zod` - request parsing and server action validation in `src/app/api/send/route.ts`, `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/app/api/ai-control/route.ts`, `src/app/api/webhook/website/route.ts`, and dashboard pages like `src/app/(dashboard)/channels/page.tsx`.
- `@upstash/qstash` - follow-up scheduling in `src/lib/queue.ts` and signature verification in `src/app/api/followup/route.ts`.
- `resend` - outbound email notifications in `src/lib/notify.ts`.
- `@vercel/functions` - background work deferral in `src/app/api/message/route.ts`, `src/app/api/webhook/website/route.ts`, and `src/lib/meta-webhook.ts`.

**Infrastructure:**
- pgvector - enabled conditionally for `public.knowledge_base.embedding` in `supabase/setup.sql` and enabled in `supabase/migrations/20240101000000_initial_schema.sql`.
- Supabase local services - ports, auth redirects, storage, realtime, and Studio are configured in `supabase/config.toml`.
- `@upstash/redis` - declared in `package.json` but not imported anywhere under `src/`.

## Configuration

**Environment:**
- Public Supabase envs are forwarded through `next.config.ts`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase server-side envs are required by `src/lib/supabase/server.ts`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- AI, email, queue, webhook, and client bootstrap envs are used in `src/lib/ai.ts`, `src/lib/notify.ts`, `src/lib/queue.ts`, `src/lib/meta-webhook.ts`, and `src/lib/active-client.ts`.
- `.env.local` and `.env.friend-share` exist at repo root; contents were not read.

**Build:**
- Next.js build behavior is configured in `next.config.ts`.
- TypeScript path aliasing and compiler strictness are configured in `tsconfig.json`.
- Styling pipeline is configured in `tailwind.config.ts` and `postcss.config.mjs`.
- Lint behavior is configured in `eslint.config.mjs`.
- Hosting framework metadata is configured in `vercel.json`.
- Database and local service configuration are defined in `supabase/config.toml`.

## Local Services

**Development Services:**
- Local app server: `npm run dev` from `package.json`, which runs `next dev` for the App Router app in `src/app`.
- Local Supabase API: enabled on port `54321` in `supabase/config.toml`.
- Local Postgres: enabled on port `54322` in `supabase/config.toml`.
- Local Supabase Studio: enabled on port `54323` in `supabase/config.toml`.
- Local email sink (`inbucket`): enabled on port `54324` in `supabase/config.toml`.
- Local realtime and storage services: enabled in `supabase/config.toml`.

## Platform Requirements

**Development:**
- Node.js and npm are required to run the scripts in `package.json`.
- Supabase CLI local infrastructure is expected when working against `supabase/config.toml` and the SQL files under `supabase/`.
- Third-party credentials are required for Clerk, Supabase, OpenRouter, Resend, QStash, and Meta webhooks before the routes in `src/app/api` can operate fully.

**Production:**
- Vercel is the intended hosting target, indicated by `vercel.json`, `@vercel/functions` usage, and the production `site_url` in `supabase/config.toml`.
- Supabase is the intended production data platform, with schema defined in `supabase/setup.sql` and the SQL migration files under `supabase/migrations/`.

---

*Stack analysis: 2026-05-23*
