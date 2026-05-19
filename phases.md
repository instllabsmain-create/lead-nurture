# Phases
> Exact prompts to give Claude Code, in order.
> Paste one at a time. Wait for it to finish before pasting the next.
> If it breaks: paste the error and say "fix only this error, don't change anything else."

---

# PHASE 1 — Setup

```
Read claude.md, architecture.md, and database.md fully before doing anything.

Run the complete setup from the Setup section in claude.md:
1. Create the Next.js project with exact flags from claude.md
2. Install all dependencies listed
3. Create GitHub repo and push using gh CLI
4. Login and link Supabase using supabase CLI
5. Create supabase/migrations/20240101000000_initial_schema.sql
   with the complete SQL from database.md — copy it exactly
6. Run: supabase db push
7. Deploy to Vercel using vercel CLI, link to GitHub repo
8. Add all environment variables to Vercel using vercel env add
   (all variables listed in architecture.md under Environment Variables)
   Select all 3 environments for each
9. Pull env vars locally: vercel env pull .env.local

Create .env.local with empty placeholder values for any keys I need
to fill in manually. Tell me which ones need manual values before continuing.

Do not write any application code yet. Setup only.
```

---

# PHASE 2 — Stubs + Types

```
Read claude.md and architecture.md.

Step 1: Create the complete folder structure from architecture.md
as empty stub files. Every file must:
- Export the correct function or component name
- Have correct TypeScript return type signature
- Return null or empty object as placeholder
- Compile with zero TypeScript errors

Step 2: Implement src/types/index.ts with every type from database.md
under the TypeScript types section.
Export everything. Zero any types.

Show me the complete folder tree when done.
```

---

# PHASE 3 — Supabase + Middleware + Auth

```
Read claude.md and database.md.

Implement these 4 files in order:

1. src/lib/supabase/client.ts
   Browser client using createBrowserClient from @supabase/ssr
   Export a createClient function

2. src/lib/supabase/server.ts
   Server client using createServerClient from @supabase/ssr
   Use cookies from next/headers
   Export a createClient function

3. src/middleware.ts
   Exactly as defined in claude.md Middleware section
   - No session → /login
   - No client row OR onboarding_completed = false → /onboarding
   - onboarding_completed = true → let through
   Matcher covers all routes in claude.md

4. src/app/auth/callback/route.ts
   Exactly as in claude.md Auth section
   onboarding_completed is the canonical flag — not business_description
   New user with no DB row → /onboarding
```

---

# PHASE 4 — Login + Onboarding

```
Read claude.md and ux.md.

Implement these 2 files:

1. src/app/(auth)/login/page.tsx
   - Full screen bg-parchment
   - Asymmetric layout — content left-aligned, right side empty
   - Wordmark top left: INSTL.LABS with saffron dot
   - Display heading Barlow Condensed 900 uppercase: "NURTURE YOUR LEADS."
   - Subtext IBM Plex Sans: "AI replies to every message. You close the deals."
   - One button only: "Continue with Google"
     calls supabase.auth.signInWithOAuth provider google
     redirectTo: window.location.origin + /auth/callback
   - No email/password fields

2. src/app/(dashboard)/onboarding/page.tsx
   3-step form on one page, step in useState

   Step 1 — label "01 — YOUR BUSINESS":
   Textarea: what does your business do?
   Multi-select chips: Product seller, Service provider, Retailer,
   Consultant, Manufacturer, Freelancer
   Continue disabled until textarea filled

   Step 2 — label "02 — YOUR CUSTOMER":
   Textarea: describe your ideal customer
   Multi-select chips: Referrals, Social media, Walk-ins,
   Cold outreach, Online ads
   Back + Continue buttons

   Step 3 — label "03 — YOUR TEAM":
   Input: business name (required)
   Radio: "Just me" or "I have a sales team"
   If team selected: number input for agent count
   Back + "Get started" button

   On submit: upsert clients table with all fields + onboarding_completed: true
   Then router.push('/dashboard')

   Progress: 3 line segments at top. Saffron = completed.
   All tokens from ux.md.
```

---

# PHASE 5 — Layout + Dashboard

```
Read claude.md and ux.md.

Implement these 3 files:

1. src/components/ui/sidebar.tsx (client component)
   - 200px fixed, bg-white, border-r border-border
   - Wordmark INSTL.LABS saffron dot at top
   - Nav: Dashboard, Inbox (unread count badge), Leads,
     Broadcasts, Agents, Channels, Knowledge Base, Settings
   - Active: bg-ember text-ember-text font-medium rounded-md
   - Inactive: text-dust hover:bg-parchment hover:text-pitch
   - Unread badge: bg-saffron text-white font-mono text-[9px] rounded-full
   - Usage bar at bottom (messages used/limit)
   - Settings pinned to very bottom

2. src/app/(dashboard)/layout.tsx (server component)
   - Fetch client profile + unread count
   - flex h-screen: sidebar left + main content right
   - Main: flex-1 overflow-auto bg-parchment

3. src/app/(dashboard)/dashboard/page.tsx (server component)
   Data to fetch:
   - Total leads count
   - Active conversations: status = 'engaging'
   - Qualified today: status = 'qualified' AND last_active > today midnight
   - Messages sent today: direction = 'outbound' AND sent_at > today midnight
   - Last 5 leads by last_active with latest message

   Layout:
   - 4 stat cards: Total / Active / Qualified Today / Sent Today
     (use stat card pattern from ux.md)
   - Section "RECENT CONVERSATIONS": 5 lead rows linking to /inbox/[id]

   All tokens from ux.md.
```

---

# PHASE 6 — AI Engine + Scoring

```
Read claude.md, agents.md, and ux.md.

Implement these 5 files using the exact code from agents.md:

1. src/lib/normalise.ts
   All 4 functions: normaliseInstagram, normaliseWhatsApp,
   normaliseFacebook, normaliseWebsite
   Use exact field mappings from agents.md

2. src/lib/prompts.ts
   buildPrompt function with exact template from agents.md

3. src/lib/ai.ts
   generateReply function using OpenRouter
   Model: google/gemini-flash-1.5, max_tokens: 300
   Last 10 messages as conversation history
   Return plain string

4. src/lib/score.ts
   scoreLead function with full scoring logic from agents.md
   Return { score: number, answers: Record<string, string> }

5. src/lib/channels/instagram.ts
   sendInstagramMessage({ recipientId, message, accessToken })
   POST to https://graph.facebook.com/v18.0/me/messages

   src/lib/channels/whatsapp.ts
   sendWhatsAppMessage({ to, message, phoneNumberId, accessToken })
   POST to https://graph.facebook.com/v18.0/{phoneNumberId}/messages

   src/lib/channels/facebook.ts
   sendFacebookMessage — same as Instagram

Zero any types. Import from src/types/index.ts.
```

---

# PHASE 7 — Assignment + Notify + Queue

```
Read agents.md.

Implement these 3 files using exact code from agents.md:

1. src/lib/assign.ts
   assignLead function with full logic:
   - Guard: return null if not agent_assignment type
   - Guard: return null if score below threshold
   - Guard: return null if already assigned
   - Get available agents, filter by territory, sort by load
   - Hot leads (>85) → least busy agent
   - Others → round robin
   - Update lead + agent in DB
   - Return agent or null

2. src/lib/notify.ts
   notifyAgent({ agent, lead, client, latestMessage })
   notifyClient({ client, lead, latestMessage })
   WhatsApp via sendWhatsAppMessage, email fallback via Resend
   Exact message templates from agents.md
   Failures must not throw — try/catch, log and continue

3. src/lib/queue.ts
   scheduleFollowUp({ leadId, clientId, message, delaySeconds })
   Use @upstash/qstash to publish to /api/followup
   Exact code from agents.md
```

---

# PHASE 8 — Webhook Routes

```
Read claude.md and apis.md.

Implement these 3 webhook routes:

1. src/app/api/webhook/instagram/route.ts
   GET: verify hub.verify_token === META_VERIFY_TOKEN → return hub.challenge
   POST:
   - Verify X-Hub-Signature-256 using META_APP_SECRET
   - Reject with 403 if invalid
   - Parse payload, normalise with normaliseInstagram()
   - Find channel by account_id + type = instagram → get client_id
   - POST to /api/message with normalised payload
   - Return 200 immediately

2. src/app/api/webhook/whatsapp/route.ts
   Same GET handler (same META_VERIFY_TOKEN)
   POST: normalise with normaliseWhatsApp() → same flow

3. src/app/api/webhook/facebook/route.ts
   Same GET handler
   POST: normalise with normaliseFacebook() → same flow

CRITICAL: No auth check on these routes
CRITICAL: Always return 200 to Meta — never let Meta wait
CRITICAL: Verify signature before processing any payload
```

---

# PHASE 9 — Core Message Pipeline

```
Read claude.md (Message pipeline section) and apis.md.

Implement src/app/api/message/route.ts

This is the most critical file. Implement exact pipeline:

1. Parse NormalisedMessage from request body
2. Create Supabase service role client (bypasses RLS)
3. Find channel by account_id + type → get client_id
   If channel not found: log and return 200 silently
4. Upsert lead on (client_id, platform_id) — update last_active
5. Save inbound message to messages table
6. Return 200 immediately here:
   import { waitUntil } from '@vercel/functions'
   waitUntil(processMessage(lead, client, ...))
   return Response.json({ ok: true })

Inside processMessage (runs after 200 is returned):
7. Fetch last 10 messages for lead
8. Fetch client record including config
9. Fetch knowledge_base entries for client
10. generateReply from lib/ai.ts
11. Save outbound message (ai_generated: true)
12. Send via correct channel adapter based on lead.channel
13. scoreLead from lib/score.ts
14. Update lead: score, answers, last_active, status = 'engaging' if score > 30
15. Check: should assign?
    score >= threshold AND assigned_agent_id is null
    AND routing.type = agent_assignment
16. If yes: assignLead from lib/assign.ts
    If agent returned: notifyAgent from lib/notify.ts
17. If routing.type = human_handoff AND score >= threshold:
    notifyClient from lib/notify.ts
18. scheduleFollowUp from lib/queue.ts (72 hours)

Wrap all of processMessage in try/catch — never throw.
No auth check on this route.
```

---

# PHASE 10 — Send + Followup Routes

```
Read apis.md.

Implement these 2 routes:

1. src/app/api/send/route.ts (POST)
   - Auth check: supabase.auth.getUser()
   - Get client record for user
   - Parse { leadId, message } from body
   - Verify lead.client_id === client.id (security check)
   - Get lead to find channel type
   - Get channel for access token
   - Send via correct channel adapter
   - Save to messages table: direction outbound, ai_generated false
   - Return { ok: true }

2. src/app/api/followup/route.ts (POST)
   - Verify QStash signature using verifySignatureAppRouter from @upstash/qstash/nextjs
   - Return 403 if invalid
   - Parse { leadId, clientId, message } from body
   - Get lead's last inbound message sent_at
   - If lead replied after this job was created: return 200 silently
   - If not: get lead + channel, send message via channel adapter
   - Save to messages table
   - Return { ok: true }
```

---

# PHASE 11 — Realtime + Inbox

```
Read claude.md (Realtime section), ux.md (Inbox section), and apis.md.

Implement these 5 files:

1. src/hooks/use-realtime.ts
   useRealtimeMessages(clientId, onNewMessage): void
   useRealtimeLeads(clientId, onLeadUpdate): void
   Both subscribe to Supabase Realtime on respective tables
   Both clean up on unmount

2. src/app/(dashboard)/inbox/page.tsx (server component)
   Fetch all leads with latest message for client
   Pass to InboxLayout client component

3. src/app/(dashboard)/inbox/[leadId]/page.tsx (server component)
   Fetch lead + all messages ordered by sent_at asc
   Pass to conversation thread

4. src/components/inbox/conversation-list.tsx (client component)
   280px left panel
   Filter tabs: All / Unread / Assigned / Qualified
   Lead items from ux.md lead card pattern
   Active: border-l-2 border-saffron bg-ember/20
   Uses useRealtimeLeads hook

5. src/components/inbox/conversation-thread.tsx (client component)
   Message bubbles exactly as in ux.md
   Inbound left (white bubble), outbound right (saffron bubble)
   AI label on ai_generated messages
   Auto-scroll to bottom
   Take over from AI button
   Uses useRealtimeMessages hook

6. src/components/inbox/message-input.tsx (client component)
   Disabled with "AI is handling" when takeover = false
   Textarea + send on Enter
   POST to /api/send on submit
   Hand back to AI button when takeover = true

All tokens from ux.md.
```

---

# PHASE 12 — Leads Pages

```
Read ux.md (leads section).

Implement these 3 files:

1. src/app/(dashboard)/leads/page.tsx (server component)
   Fetch leads sorted by last_active desc
   Accept searchParams: status, channel, assigned, min_score
   Filter bar at top
   Lead cards linking to /leads/[id]
   Empty state: "No leads yet."

2. src/components/leads/lead-card.tsx (client component)
   From ux.md lead card pattern
   Avatar + name + handle + channel badge + status badge
   Score badge (saffron >80, ember 50-80, parchment <50)
   Last message preview (60 chars)
   Assigned agent name if assigned

3. src/app/(dashboard)/leads/[id]/page.tsx (server component)
   Two column: left 65% conversation thread, right 35% profile panel
   Profile panel:
   - Large avatar + name
   - Score bar (bg-saffron fill, percentage of 100)
   - Status + channel badges
   - Qualification answers list
   - Assigned agent + reassign dropdown
   - Timeline: first contact, engaging, qualified, assigned

All tokens from ux.md.
```

---

# PHASE 13 — Channels + Agents + Knowledge + Settings

```
Read ux.md prd.md.

Implement these 4 pages:

1. src/app/(dashboard)/channels/page.tsx
   4 channel cards in 2x2 grid
   Instagram: OAuth connect button or connected state (account name + disconnect)
   WhatsApp: Show webhook URL + verify token with copy buttons + token input form
   Facebook: OAuth connect button or connected state
   Website: Show embed script with copy button

2. src/app/(dashboard)/agents/page.tsx
   If routing.type !== agent_assignment: show "Enable in Settings" message
   Otherwise:
   Agent list: name, phone, active/max leads, availability toggle, territories
   Add agent inline form: name, phone, email, territories, specialities, max_leads
   Delete with confirmation

3. src/app/(dashboard)/knowledge/page.tsx
   Info banner at top (bg-ember)
   Add entry inline form: title (optional) + content (required)
   Entry list: title + 120 char preview + date + delete

4. src/app/(dashboard)/settings/page.tsx
   4 tabs: AI / Qualification / Routing / Account
   AI tab: system prompt textarea, language select, response delay radio
   Qualification tab: ordered list of questions with add/delete
   Routing tab: type radio, threshold slider, triggers textarea, notify checkboxes
   Account tab: business name input, email readonly, plan badge
   Save button per tab → update clients.config → show toast "Saved."

All tokens from ux.md.
```

---

# PHASE 14 — Final checks + Deploy

```
Now do a final review pass:

1. Check every file imports types from src/types/index.ts only — no inline type definitions
2. Check every API route (except webhooks) has auth check at the top
3. Check /api/message uses waitUntil correctly
4. Check all DB queries include client_id filter
5. Check middleware matcher includes all dashboard routes
6. Check sidebar shows correct active state for current route
7. Check realtime subscriptions clean up on unmount

Fix any issues found.

Then:
git add .
git commit -m "feat: instl-nurture v1 complete"
git push

Vercel will auto-deploy. Tell me when all checks pass.
```

---

## Error handling template

```
Error after Phase [NUMBER]:

[PASTE FULL ERROR]

Fix only this error. Do not change anything else.
```
