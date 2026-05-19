# Architecture
> How the system is structured, how data flows, and how everything connects.

---

## System overview

```
Client's customer sends DM
          ↓
Meta Platform (Instagram / WhatsApp / Facebook)
          ↓
Webhook POST → instllabs.com/api/webhook/{channel}
          ↓
Normalise payload (lib/normalise.ts)
          ↓
POST /api/message (core pipeline)
          ↓
┌──────────────────────────────────────┐
│  Find / create lead in Supabase      │
│  Save inbound message                │
│  Return 200 immediately              │
│  ↓ (waitUntil)                       │
│  Generate AI reply (lib/ai.ts)       │
│  Save + send outbound message        │
│  Score lead (lib/score.ts)           │
│  Assign agent (lib/assign.ts)        │
│  Notify (lib/notify.ts)              │
│  Schedule follow-up (lib/queue.ts)   │
└──────────────────────────────────────┘
          ↓
Client sees conversation in Inbox
(Supabase Realtime pushes update)
```

---

## Multi-tenancy

One platform, many clients. Isolation is enforced at two levels:

**Row Level Security (Supabase RLS):**
Every table has a policy that filters by `client_id`.
Even if there's a bug in the application code, the DB rejects cross-client queries.

**Application level:**
Every query explicitly includes `.eq('client_id', client.id)`.
Auth check → get client_id → filter all queries by it.

**Never:**
- Return data without a `client_id` filter
- Use service role key in browser-side code
- Expose one client's data to another

---

## Folder structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx              ← Google OAuth login
│   ├── (dashboard)/
│   │   ├── layout.tsx                  ← Sidebar + auth wrapper
│   │   ├── onboarding/page.tsx         ← 3-step setup flow
│   │   ├── dashboard/page.tsx          ← Stats + recent activity
│   │   ├── inbox/
│   │   │   ├── page.tsx                ← Conversation list
│   │   │   └── [leadId]/page.tsx       ← Conversation thread
│   │   ├── leads/
│   │   │   ├── page.tsx                ← All leads + filters
│   │   │   └── [id]/page.tsx           ← Lead detail + profile
│   │   ├── agents/page.tsx             ← Manage sales team
│   │   ├── channels/page.tsx           ← Connect platforms
│   │   ├── knowledge/page.tsx          ← Business knowledge for AI
│   │   ├── broadcasts/page.tsx         ← Phase 2
│   │   └── settings/page.tsx           ← AI + routing config
│   ├── auth/
│   │   └── callback/route.ts           ← OAuth callback handler
│   └── api/
│       ├── webhook/
│       │   ├── instagram/route.ts      ← Meta Instagram webhook
│       │   ├── whatsapp/route.ts       ← Meta WhatsApp webhook
│       │   ├── facebook/route.ts       ← Meta Facebook webhook
│       │   └── website/route.ts        ← Widget webhook
│       ├── message/route.ts            ← Core message pipeline ⭐
│       ├── send/route.ts               ← Human agent reply
│       ├── followup/route.ts           ← QStash follow-up handler
│       └── broadcast/route.ts          ← Phase 2
├── components/
│   ├── ui/
│   │   ├── sidebar.tsx                 ← App navigation
│   │   ├── wordmark.tsx                ← INSTL.LABS logo
│   │   └── loading-dots.tsx            ← Saffron bounce animation
│   ├── inbox/
│   │   ├── conversation-list.tsx       ← Left panel lead list
│   │   ├── conversation-thread.tsx     ← Message bubbles
│   │   └── message-input.tsx           ← Reply input
│   ├── leads/
│   │   ├── lead-card.tsx               ← Lead list item
│   │   ├── lead-score.tsx              ← Score bar + badge
│   │   └── lead-detail.tsx             ← Profile panel
│   └── dashboard/
│       └── stats-row.tsx               ← 4 stat cards
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   ← Browser client
│   │   └── server.ts                   ← Server client
│   ├── normalise.ts                    ← Channel payload → NormalisedMessage
│   ├── prompts.ts                      ← All AI prompts ← change AI behaviour here
│   ├── ai.ts                           ← OpenRouter call
│   ├── score.ts                        ← Lead scoring engine
│   ├── assign.ts                       ← Agent assignment engine
│   ├── notify.ts                       ← WhatsApp + email notifications
│   ├── queue.ts                        ← Upstash QStash scheduling
│   └── channels/
│       ├── instagram.ts                ← Send Instagram DM
│       ├── whatsapp.ts                 ← Send WhatsApp message
│       ├── facebook.ts                 ← Send Facebook message
│       └── website.ts                  ← Send website widget reply
├── hooks/
│   ├── use-realtime.ts                 ← Supabase Realtime subscriptions
│   └── use-conversations.ts            ← Conversation state management
├── types/
│   └── index.ts                        ← All TypeScript types
└── middleware.ts                       ← Auth + onboarding guard
```

---

## Data flow — inbound message

```
Instagram DM arrives
        ↓
GET /api/webhook/instagram (Meta verification — one time only)
        ↓
POST /api/webhook/instagram
  1. Verify X-Hub-Signature-256 header
  2. Parse payload
  3. normaliseInstagram(payload, clientId) → NormalisedMessage
  4. Find client via channel.account_id
  5. POST to /api/message
        ↓
POST /api/message
  1. Parse NormalisedMessage
  2. Get Supabase service role client
  3. Find channel → client_id
  4. Upsert lead (client_id + platform_id unique)
  5. Save inbound message
  6. Return 200 ← Meta never waits longer than this
  ↓ waitUntil continues:
  7. Fetch context (last 10 msgs + client config + knowledge base)
  8. Generate reply (lib/ai.ts → OpenRouter)
  9. Save outbound message
  10. Send via lib/channels/instagram.ts
  11. Score (lib/score.ts) → update lead
  12. Maybe assign (lib/assign.ts) → notify (lib/notify.ts)
  13. Schedule follow-up (lib/queue.ts)
```

---

## Data flow — follow-up

```
lib/queue.ts scheduleFollowUp()
        ↓
Upstash QStash: delay 72 hours
        ↓
POST /api/followup (called by QStash after delay)
  1. Verify QStash signature
  2. Get lead's last inbound message timestamp
  3. If lead replied since scheduling → skip (do nothing)
  4. If not → send follow-up message
  5. Mark follow_up record as sent
```

---

## Data flow — human reply

```
Agent clicks reply in inbox
        ↓
message-input.tsx sends POST /api/send
        ↓
/api/send
  1. Auth check
  2. Verify lead belongs to this client
  3. Send via correct channel adapter
  4. Save to messages table
  5. Return { ok: true }
        ↓
Supabase Realtime fires
        ↓
conversation-thread.tsx updates live
```

---

## Channel adapter pattern

Every channel has an adapter that:
1. Sends outbound messages to that platform
2. Uses the platform's specific API format

All adapters are called the same way from the pipeline:

```typescript
switch (lead.channel) {
  case 'instagram':
    await sendInstagramMessage({ recipientId, message, accessToken })
    break
  case 'whatsapp':
    await sendWhatsAppMessage({ to, message, phoneNumberId, accessToken })
    break
  case 'facebook':
    await sendFacebookMessage({ recipientId, message, accessToken })
    break
  case 'website':
    await sendWebsiteMessage({ sessionId, message, clientId })
    break
}
```

---

## Client config architecture

The `config` jsonb column drives all behaviour. This is how one codebase serves every type of business without code changes:

```
Real estate client config:
  routing.type = 'agent_assignment'
  routing.assignment_threshold = 65
  qualification_questions = ['budget', 'location', 'type', 'timeline']
  agents = [{ territories: ['bandra'], ... }, ...]

Freelancer config:
  routing.type = 'human_handoff'
  routing.notify_via = ['whatsapp']
  qualification_questions = ['project type', 'budget', 'timeline']
  ai.language = 'hinglish'
```

One platform serves both. No code change. Just config.

---

## Supabase service role usage

The service role key bypasses RLS. Only use it in:
- `/api/message` — needs to write on behalf of any client (no user session)
- `/api/followup` — called by QStash, no user session
- `/api/webhook/*` — called by Meta, no user session

Never expose the service role key to the browser. Never use it in client components.

---

## Vercel + QStash integration

Follow-up scheduling uses Upstash QStash:

```
lib/queue.ts
  → qstash.publishJSON({ url: '/api/followup', delay: 72h, body: { leadId, ... } })
  → QStash stores the job
  → After 72 hours: QStash POSTs to /api/followup
  → Route verifies QStash signature
  → Sends follow-up if lead hasn't replied
```

QStash is stateless — no server to manage, no cron job to configure.
Vercel is also stateless — routes scale automatically.
Together: infinite scale, zero infrastructure.

---

## Realtime architecture

Supabase Realtime uses PostgreSQL logical replication to push DB changes to connected clients.

```
DB INSERT on messages table
        ↓
Supabase Realtime broadcasts to subscribed clients
        ↓
use-realtime.ts hook receives event
        ↓
React state updates
        ↓
Inbox updates without refresh
```

Subscription is per-client (filtered by `client_id`).
One subscription per browser session — not per conversation.
Clean up on unmount to prevent memory leaks.

---

## Environment variable reference

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=           # project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # safe to expose to browser
SUPABASE_SERVICE_ROLE_KEY=          # NEVER expose to browser

# AI
OPENROUTER_API_KEY=                 # server-side only

# Meta (Instagram + WhatsApp + Facebook webhooks)
META_APP_SECRET=                    # for signature verification
META_VERIFY_TOKEN=instl_nurture_verify_9mKx3pQ7

# Upstash
QSTASH_TOKEN=                       # for publishing jobs
QSTASH_CURRENT_SIGNING_KEY=         # for verifying incoming QStash requests
QSTASH_NEXT_SIGNING_KEY=            # rotating key
UPSTASH_REDIS_REST_URL=             # if using Redis for caching
UPSTASH_REDIS_REST_TOKEN=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=                # full URL — used in webhook URLs and deep links
```
