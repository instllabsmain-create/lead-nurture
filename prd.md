# PRD
> What every feature does. User stories, flows, acceptance criteria.

---

## PRD-01 — Auth & Onboarding

### Auth
- Google OAuth only via Supabase
- `/auth/callback` checks `onboarding_completed` flag
- False or no row → `/onboarding`
- True → `/dashboard`
- Middleware protects all dashboard routes

### Onboarding — 3 steps

**Step 1 — Your Business**
- Textarea: what does your business do?
- Multi-select chips: Product seller, Service provider, Retailer, Consultant, Manufacturer, Freelancer
- Continue disabled until textarea filled

**Step 2 — Your Customer**
- Textarea: describe your ideal customer
- Multi-select chips: Referrals, Social media, Walk-ins, Cold outreach, Online ads

**Step 3 — Your Team**
- Text input: business name (required)
- Radio: "Just me" / "I have a sales team"
- If team: number of agents input

On submit: upsert `clients` table with all fields + `onboarding_completed: true` → redirect to `/dashboard`

### Acceptance criteria
- [ ] Google login works end to end
- [ ] New user → onboarding, not dashboard
- [ ] Returning user → dashboard, not onboarding
- [ ] All fields save to clients.config
- [ ] Cannot access dashboard without completing onboarding
- [ ] Back button preserves filled values

---

## PRD-02 — Omnichannel Inbox

### Layout
Split panel: 280px conversation list + flex-1 thread

### Conversation list
- Filter tabs: All / Unread / Assigned / Qualified
- Each item: avatar + name + channel badge + score badge + preview + time ago
- Active: `border-l-2 border-saffron`
- Unread dot on leads with new messages
- Realtime updates via Supabase

### Conversation thread
- Inbound: left aligned, white bubble
- Outbound: right aligned, saffron bubble
- AI messages: small `AI` label in bubble
- Auto-scroll to bottom

### Message input
- Disabled when AI is handling (shows "AI is handling this")
- "Take over from AI" button enables input
- Enter sends, Shift+Enter = new line
- Sends via POST `/api/send`
- "Hand back to AI" re-disables input

### Acceptance criteria
- [ ] All conversations from all channels appear
- [ ] Filter tabs work
- [ ] New messages appear in real time
- [ ] Take over / hand back works
- [ ] Human replies send and appear in thread

---

## PRD-03 — AI Conversation Engine

### What it does
Replies to every inbound message in the client's voice. Asks qualification questions. Uses knowledge base for accurate answers. Max 2–3 sentences per reply.

### Behaviour
- Asks questions one at a time (from config)
- Does not repeat already-answered questions
- Detects when lead is ready to buy → suggests human follow-up
- Auto-detects language (or uses client config)
- Falls back gracefully if API fails

### Acceptance criteria
- [ ] AI replies to every inbound message
- [ ] Language auto-detection works
- [ ] Questions asked one at a time
- [ ] Already-answered questions not repeated
- [ ] Knowledge base content used in answers
- [ ] API errors don't crash the pipeline

---

## PRD-04 — Lead Scoring

### Score range
0–100. Starts at 0, increases/decreases per message.

### Scoring events
- Question answered: +10 (default)
- Buying signal ("interested", "price", "when can", "book"): +15
- Urgency signal ("urgent", "today", "asap", "this week"): +20
- Negative signal ("not interested", "just browsing", "too expensive"): -20

### Score bands
- 81–100: Hot — immediate assign/notify
- 51–80: Warm — continue nurturing
- 0–50: Cold — schedule follow-up

### Acceptance criteria
- [ ] Score increases on buying signals
- [ ] Score decreases on negative signals
- [ ] Answers extracted and saved to lead.answers
- [ ] Score capped 0–100
- [ ] Score persists between messages

---

## PRD-05 — Agent Assignment

### When it runs
Score crosses `config.routing.assignment_threshold` (default 70) AND lead not already assigned AND routing type is `agent_assignment`.

### Selection logic
1. Get available agents (`is_available = true`, `active_leads < max_leads`)
2. Filter by territory match (if lead location known)
3. Sort by `active_leads` ascending
4. Score > 85: assign to least busy
5. Otherwise: round robin
6. Update lead + increment agent.active_leads

### Human handoff mode
When `routing.type = 'human_handoff'`: skip assignment, notify client owner directly.

### Acceptance criteria
- [ ] Returns null if routing type not agent_assignment
- [ ] Returns null if score below threshold
- [ ] Returns null if already assigned
- [ ] Territory matching works
- [ ] lead.assigned_agent_id and agent.active_leads updated correctly

---

## PRD-06 — Notifications

### Agent notification (WhatsApp)
Sent when lead is assigned. Contains:
- Lead name + score + channel
- Latest message
- Qualification answers collected
- Link to conversation

### Client notification (WhatsApp — human handoff)
Sent when score crosses threshold in handoff mode.

### Email fallback
If WhatsApp send fails OR client prefers email: send via Resend.

### Acceptance criteria
- [ ] Agent receives WhatsApp when assigned
- [ ] Message contains all required info
- [ ] Notification respects `config.routing.notify_via`
- [ ] Failures don't crash the pipeline

---

## PRD-07 — Channel Connections

### Channels
| Channel | Method |
|---|---|
| Instagram | Meta OAuth |
| WhatsApp | Manual token + webhook |
| Facebook | Meta OAuth |
| Website | JS widget embed |

### Instagram / Facebook connect
OAuth → exchange code → store access token → subscribe to `messages` webhook field

### WhatsApp connect
Show webhook URL + verify token on page → client pastes into Meta → client pastes access token + phone number ID into form → save to channels table

### Website widget
Show embed code: `<script src="/widget.js" data-client="{id}"></script>`

### Acceptance criteria
- [ ] Instagram OAuth stores token
- [ ] WhatsApp manual token saves
- [ ] Website embed code shows correct client ID
- [ ] Webhook URL and verify token shown with copy buttons
- [ ] Connected state shows account name
- [ ] Disconnect sets status to disconnected

---

## PRD-08 — Knowledge Base

### What it is
Clients add business info (pricing, FAQs, services, policies) as text entries. AI reads all entries before every reply.

### Add entry
- Title (optional) + content textarea (required)
- Inline form — no modal

### List
- Shows title + 120 char preview + date
- Delete with confirmation

### Acceptance criteria
- [ ] Add/delete entries works
- [ ] AI uses knowledge base in replies
- [ ] Empty state shown correctly

---

## PRD-09 — Follow-Up Scheduler

### Trigger
After every AI reply, schedule a follow-up 72 hours later via QStash.

### Cancel condition
If lead has replied since scheduling → skip silently.

### Message
`"Hi {firstName}, just checking in — still interested?"`

### Acceptance criteria
- [ ] Follow-up scheduled after every AI reply
- [ ] Fires 72 hours later
- [ ] Does NOT fire if lead replied in the meantime
- [ ] QStash signature verified before processing

---

## PRD-10 — Leads Management

### Leads list (`/leads`)
- All leads sorted by `last_active DESC`
- Filters: status, channel, assigned, score range
- Lead card: avatar + name + badges + preview + assigned agent

### Lead detail (`/leads/[id]`)
- Left: full conversation thread
- Right: profile panel (score bar, answers, tags, timeline, assigned agent)
- Manual status change
- Reassign to different agent

### Acceptance criteria
- [ ] All leads shown with correct data
- [ ] Filters work
- [ ] Lead detail shows conversation + profile
- [ ] Score bar visual correct
- [ ] Manual status change saves

---

## PRD-11 — Settings

### Tab 1 — AI
- System prompt (override)
- Language: Auto / English / Hindi / Hinglish
- Response delay: Instant / 30s / 1min / 2min

### Tab 2 — Qualification
- Add / reorder / delete qualification questions

### Tab 3 — Routing
- Type: Human handoff / Agent assignment
- Assignment threshold slider (50–100)
- Handoff trigger phrases
- Notify via checkboxes

### Tab 4 — Account
- Business name (editable)
- Email (readonly)
- Plan badge

### Acceptance criteria
- [ ] All 4 tabs render
- [ ] All settings save to clients.config
- [ ] Save toast appears
- [ ] Config changes affect AI behaviour immediately

---

## PRD-12 — Dashboard

### Stats row (4 cards)
- Total leads
- Active conversations (status = engaging)
- Qualified today
- Messages sent today (outbound)

### Recent conversations
Last 5 leads by `last_active` — each links to `/inbox/[id]`

### Quick actions
If no channels: show "Connect a channel" card
If no knowledge: show "Add business info" card

### Acceptance criteria
- [ ] All stat counts correct
- [ ] Recent conversations list correct
- [ ] Quick action cards show when relevant
- [ ] Page loads under 2 seconds
