# External Integrations

**Analysis Date:** 2026-05-23

## APIs & External Services

**Authentication & Identity:**
- Clerk - primary application authentication, route protection, and hosted auth UI.
  - SDK/Client: `@clerk/nextjs`
  - Auth: Clerk-managed environment variables are required operationally, but their names are not hardcoded in repo; integration points are `src/app/layout.tsx`, `src/middleware.ts`, `src/lib/active-client.ts`, `src/app/(auth)/login/[[...login]]/page.tsx`, and `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**Database Platform:**
- Supabase - primary database, SSR/browser client layer, realtime transport, and service-role access.
  - SDK/Client: `@supabase/ssr`, `@supabase/supabase-js`
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Implementation: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/hooks/use-realtime.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/api/message/route.ts`

**LLM:**
- OpenRouter - chat completion API used to generate AI replies.
  - SDK/Client: raw `fetch` in `src/lib/ai.ts`
  - Auth: `OPENROUTER_API_KEY`

**Messaging Channels:**
- Meta Graph API - outbound message delivery for WhatsApp, Facebook Messenger, and Instagram DMs.
  - SDK/Client: raw `fetch` in `src/lib/channels/whatsapp.ts`, `src/lib/channels/facebook.ts`, `src/lib/channels/instagram.ts`
  - Auth: per-channel `access_token` values stored in `public.channels.access_token`; webhook verification uses `META_VERIFY_TOKEN` and `META_APP_SECRET`
- Website inbound widget/webhook - inbound website messages are accepted through `src/app/api/webhook/website/route.ts` and normalized in `src/lib/normalise.ts`.
  - SDK/Client: no external SDK; plain HTTP POST expected
  - Auth: no signature validation is implemented; payload validation relies on `zod` and a `client_id` existence check in `src/app/api/webhook/website/route.ts`

**Background Jobs / Queues:**
- Upstash QStash - schedules delayed follow-up messages and signs callback delivery.
  - SDK/Client: `@upstash/qstash`
  - Auth: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
  - Implementation: scheduling in `src/lib/queue.ts`, verification and delivery in `src/app/api/followup/route.ts`

**Email:**
- Resend - sends notification emails to agents and clients when WhatsApp delivery is unavailable or email is preferred.
  - SDK/Client: `resend`
  - Auth: `RESEND_API_KEY`
  - Implementation: `src/lib/notify.ts`

**Hosting Runtime:**
- Vercel runtime helpers - async fan-out is deferred with `waitUntil`.
  - SDK/Client: `@vercel/functions`
  - Auth: Not applicable
  - Implementation: `src/lib/meta-webhook.ts`, `src/app/api/message/route.ts`, `src/app/api/webhook/website/route.ts`

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Client: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
  - Schema: `supabase/setup.sql` plus migrations in `supabase/migrations/20240101000000_initial_schema.sql`, `supabase/migrations/20240104000000_leads_ai_paused.sql`, `supabase/migrations/20240105000000_clients_clerk_user_id.sql`
  - Core tables used by app code: `clients`, `channels`, `agents`, `leads`, `messages`, `knowledge_base`, `follow_ups`, `broadcasts` via queries under `src/app` and `src/lib`
  - Additional table present in schema: `waitlist` in `supabase/setup.sql`

**File Storage:**
- Supabase Storage is enabled in `supabase/config.toml`, but no storage API calls were found under `src/`.

**Caching:**
- None in active application code.
- `@upstash/redis` is declared in `package.json`, but no imports were found under `src/`.

## Authentication & Identity

**Auth Provider:**
- Clerk
  - Implementation: `ClerkProvider` wraps the app in `src/app/layout.tsx`, `clerkMiddleware` protects routes in `src/middleware.ts`, and `auth()` plus `currentUser()` in `src/lib/active-client.ts` attach Clerk identities to client records.

**Identity Mapping:**
- Clerk user IDs are stored on `public.clients.clerk_user_id`.
  - Implementation: `src/lib/active-client.ts`
  - Schema support: `supabase/migrations/20240105000000_clients_clerk_user_id.sql` and `supabase/setup.sql`

**Supabase Auth Config:**
- Local Supabase auth is configured in `supabase/config.toml` with callback URLs for `/auth/callback`, and `[auth.external.google]` is enabled there.
  - Application code still uses Clerk-based login screens and middleware rather than Supabase auth UI.

## Monitoring & Observability

**Error Tracking:**
- None detected - no Sentry, Bugsnag, Datadog, or similar SDKs are imported under `src/`.

**Logs:**
- Application errors are logged with `console.error` in route handlers and library modules such as `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/lib/meta-webhook.ts`, `src/lib/notify.ts`, and `src/lib/queue.ts`.

## CI/CD & Deployment

**Hosting:**
- Vercel is the active deployment target inferred from `vercel.json`, `@vercel/functions` usage, and the production URL configured in `supabase/config.toml` (`site_url = "https://lead-nurture-one.vercel.app"`).

**CI Pipeline:**
- None detected - no workflow files were found under `.github/workflows`, and no alternate CI configuration files were found at repo root.

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - required by `next.config.ts`, `src/lib/supabase/client.ts`, and `src/lib/supabase/server.ts`
- `SUPABASE_SERVICE_ROLE_KEY` - required by `src/lib/supabase/server.ts`
- `OPENROUTER_API_KEY` - required by `src/lib/ai.ts`
- `RESEND_API_KEY` - required by `src/lib/notify.ts`
- `NEXT_PUBLIC_APP_URL` - required by `src/lib/queue.ts`, used for links in `src/lib/notify.ts`, and displayed in `src/app/(dashboard)/channels/page.tsx`
- `QSTASH_TOKEN` - required by `src/lib/queue.ts`
- `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` - required by `src/app/api/followup/route.ts`
- `META_VERIFY_TOKEN`, `META_APP_SECRET` - required by `src/lib/meta-webhook.ts`; `META_VERIFY_TOKEN` status is surfaced in `src/app/(dashboard)/channels/page.tsx`
- `APP_CLIENT_ID`, `DEMO_CLIENT_ID`, `APP_CLIENT_NAME`, `APP_CLIENT_EMAIL` - optional bootstrap/default-client envs used by `src/lib/active-client.ts`
- Clerk env vars - operationally required by `@clerk/nextjs`, but not named directly in application source

**Secrets location:**
- Repo-root `.env.local` and `.env.friend-share` files exist; contents were not read.
- `supabase/config.toml` uses `env(...)` placeholders for local Supabase-managed secrets such as Google OAuth and other provider credentials.

## Webhooks & Callbacks

**Incoming:**
- `GET` and `POST` `/api/webhook/whatsapp` - Meta verification and WhatsApp webhook intake in `src/app/api/webhook/whatsapp/route.ts`
- `GET` and `POST` `/api/webhook/facebook` - Meta verification and Facebook webhook intake in `src/app/api/webhook/facebook/route.ts`
- `GET` and `POST` `/api/webhook/instagram` - Meta verification and Instagram webhook intake in `src/app/api/webhook/instagram/route.ts`
- `POST` `/api/webhook/website` - website widget intake in `src/app/api/webhook/website/route.ts`
- `POST` `/api/followup` - signed Upstash QStash callback in `src/app/api/followup/route.ts`
- `GET` `/auth/callback` - auth redirect endpoint in `src/app/auth/callback/route.ts`

**Outgoing:**
- `POST https://openrouter.ai/api/v1/chat/completions` - AI reply generation from `src/lib/ai.ts`
- `POST https://graph.facebook.com/v18.0/me/messages` - Facebook and Instagram outbound sends from `src/lib/channels/facebook.ts` and `src/lib/channels/instagram.ts`
- `POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages` - WhatsApp outbound sends from `src/lib/channels/whatsapp.ts`
- `resend.emails.send(...)` - email sends from `src/lib/notify.ts`
- `publishJSON({ url: \`\${NEXT_PUBLIC_APP_URL}/api/followup\` })` - QStash job creation from `src/lib/queue.ts`
- Internal HTTP fan-out to `/api/message` - webhook forwarding from `src/lib/meta-webhook.ts` and `src/app/api/webhook/website/route.ts`

## Realtime & Internal Eventing

**Realtime Subscriptions:**
- Supabase Realtime is used on the client in `src/hooks/use-realtime.ts`.
  - `messages` `INSERT` events are subscribed to per `client_id`
  - `leads` `UPDATE` events are subscribed to per `client_id`

**Internal Pipeline:**
- External webhook routes normalize payloads in `src/lib/normalise.ts` and forward them into the shared message pipeline at `src/app/api/message/route.ts`.
- The message pipeline persists the inbound event, optionally calls OpenRouter, can notify via WhatsApp or Resend, and schedules a QStash follow-up.

---

*Integration audit: 2026-05-23*
