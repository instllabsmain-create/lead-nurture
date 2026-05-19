# Claude
> Read this file plus architecture.md, database.md, and apis.md before writing any code.
> This is the source of truth for how you work on this project.

---

## Project

INSTL.LABS Lead Nurturer — multi-tenant AI lead nurturing SaaS for Indian MSMEs.

Businesses connect Instagram, WhatsApp, Facebook, and website chat. The AI replies to every inbound message, qualifies leads, scores them 0–100, and routes them to the right agent or notifies the owner.

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS + custom brand tokens (see ux.md) |
| Auth + DB | Supabase (Google OAuth only) |
| AI | OpenRouter — model: `google/gemini-flash-1.5` |
| Queue | Upstash QStash (follow-up scheduling) |
| Cache | Upstash Redis |
| Email | Resend |
| Deployment | Vercel |

---

## Setup — run this first, before any application code

### 1. Create project
```bash
npx create-next-app@latest instl-nurture \
  --typescript --tailwind --app --src-dir --turbopack
cd instl-nurture
```

### 2. Install dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr \
  @upstash/qstash @upstash/redis \
  resend zod
```

### 3. GitHub
```bash
git init && git add . && git commit -m "init: instl-nurture"
gh repo create instl-nurture --private --source=. --push
```

### 4. Supabase
```bash
supabase login
supabase init
supabase link
```
Run the full schema from `database.md` in the Supabase SQL editor, then:
```bash
supabase db push
```

### 5. Vercel
```bash
vercel
```
Link to the GitHub repo. Note the production URL.

### 6. Environment variables
Add each to Vercel (select all 3 environments each time):
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENROUTER_API_KEY
vercel env add META_APP_SECRET
vercel env add META_VERIFY_TOKEN
vercel env add QSTASH_TOKEN
vercel env add QSTASH_CURRENT_SIGNING_KEY
vercel env add QSTASH_NEXT_SIGNING_KEY
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add RESEND_API_KEY
vercel env add NEXT_PUBLIC_APP_URL
```
Pull locally:
```bash
vercel env pull .env.local
```

---

## Auth

Provider: Google OAuth only.

Auth flow:
- User signs in with Google
- Redirected to `/auth/callback`
- Check `clients` table for `user_id`
- No row OR `onboarding_completed = false` → `/onboarding`
- `onboarding_completed = true` → `/dashboard`

`onboarding_completed` is the canonical flag. Not `business_description`. Not anything else.

---

## Config system

Every client has a `config` jsonb column that drives ALL behaviour.
Never hardcode business logic — always read from config with defaults.

Default config:
```typescript
const DEFAULT_CONFIG = {
  qualification_questions: [
    "What product or service are you looking for?",
    "What is your budget range?",
    "When are you looking to get started?",
    "Where are you located?"
  ],
  scoring: {
    question_answered: 10,
    buying_signal: 15,
    urgency_signal: 20,
    negative_signal: -20,
  },
  routing: {
    type: 'human_handoff',
    assignment_threshold: 70,
    handoff_triggers: ['talk to someone', 'human', 'call me', 'speak to'],
    notify_via: ['whatsapp'],
    accept_timeout_minutes: 10,
    fallback: 'notify_owner',
  },
  ai: {
    model: 'google/gemini-flash-1.5',
    language: 'auto',
    response_delay_seconds: 0,
  },
  disabled_features: [],
}
```

---

## Message pipeline — the core of everything

Every inbound message goes through this exact sequence in `/api/message`:

```
1.  Parse NormalisedMessage from body
2.  Find channel by account_id + type → get client_id
3.  Upsert lead on (client_id, platform_id)
4.  Save inbound message
5.  ← Return 200 here, process rest with waitUntil →
6.  Fetch last 10 messages for context
7.  Fetch client config + knowledge base
8.  Generate AI reply (lib/ai.ts)
9.  Save outbound message (ai_generated: true)
10. Send via correct channel adapter
11. Score lead (lib/score.ts)
12. Update lead score + answers + last_active
13. Check if should assign agent
14. If yes: assign (lib/assign.ts) + notify (lib/notify.ts)
15. Schedule follow-up (lib/queue.ts) — 72 hours
```

Use `waitUntil` from `@vercel/functions` so the route returns 200 immediately after step 4.

---

## Hard rules — never break these

1. Every DB query filters by `client_id` — no exceptions
2. Webhook routes (`/api/webhook/*`) have NO auth check — Meta calls them directly
3. All other routes auth-check first
4. `/api/message` must return 200 in under 5 seconds — use `waitUntil`
5. No `any` types anywhere — all types from `src/types/index.ts`
6. All business logic in `src/lib/` — never inline in API routes
7. All prompts in `src/lib/prompts.ts` — never hardcode in `src/lib/ai.ts`
8. Config always has defaults — never crash on missing config field
9. Webhook signature must be verified before processing any payload
10. No meeting scheduler feature in this version
11. Never store access tokens in plain text in logs
12. Error in notification or AI must NOT crash the pipeline — log and continue

---

## Supabase clients

Browser (client components):
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

Server (server components + API routes):
```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export const createClient = () => {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options))
      }
    }
  )
}
```

For internal API routes that need to bypass RLS (webhook, message pipeline):
Use service role key with `createServerClient` and service role key.

---

## Middleware

```typescript
// src/middleware.ts
export const config = {
  matcher: [
    '/dashboard/:path*', '/inbox/:path*', '/leads/:path*',
    '/broadcasts/:path*', '/agents/:path*', '/channels/:path*',
    '/knowledge/:path*', '/settings/:path*', '/onboarding',
  ]
}
```

Logic:
- No session → `/login`
- No client row OR `onboarding_completed = false` → `/onboarding`
- Pass through otherwise

---

## Realtime

Supabase Realtime for inbox live updates:
```typescript
supabase.channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `client_id=eq.${clientId}`
  }, handler)
  .subscribe()
```

Clean up subscription on component unmount.

---

## OpenRouter call

```typescript
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-flash-1.5',
    max_tokens: 300,
    messages: [...history, { role: 'user', content: latestMessage }],
  }),
})
const data = await res.json()
return data.choices[0].message.content.trim()
```

---

## Webhook verification (Instagram + WhatsApp + Facebook)

GET (Meta verification):
```typescript
if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
  return new Response(challenge, { status: 200 })
}
return new Response('Forbidden', { status: 403 })
```

POST (signature check):
```typescript
const signature = req.headers.get('x-hub-signature-256')
// Verify HMAC-SHA256 using META_APP_SECRET
// Reject if invalid
```

---

## Build order

See `phases.md` for the exact prompt sequence.
High-level order:

```
Setup → Types → Supabase → Middleware → Auth →
Onboarding → Layout → Dashboard →
Normalise → AI → Score → Channels →
Webhooks → Message pipeline → Send → Followup →
Realtime → Inbox → Leads → Channels page →
Agents → Knowledge → Settings
```
