# APIs
> Every API route. Input, output, auth, errors, implementation notes.

---

## Route index

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET/POST | `/api/webhook/instagram` | None | Meta Instagram webhook |
| GET/POST | `/api/webhook/whatsapp` | None | Meta WhatsApp webhook |
| GET/POST | `/api/webhook/facebook` | None | Meta Facebook webhook |
| POST | `/api/webhook/website` | None | Website widget webhook |
| POST | `/api/message` | None (internal) | Core message pipeline |
| POST | `/api/send` | Required | Human agent reply |
| POST | `/api/followup` | QStash signature | Scheduled follow-up handler |
| POST | `/api/broadcast` | Required | Phase 2 — bulk send |

---

## GET/POST `/api/webhook/instagram`

### GET — Meta webhook verification

Called once by Meta when you save the webhook URL in the developer portal.

**Request params:**
- `hub.mode` = `"subscribe"`
- `hub.verify_token` = your verify token
- `hub.challenge` = random string Meta wants echoed back

**Logic:**
```typescript
if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
  return new Response(challenge, { status: 200 })
}
return new Response('Forbidden', { status: 403 })
```

### POST — Inbound Instagram DM

**Headers:**
- `X-Hub-Signature-256`: HMAC-SHA256 of body using `META_APP_SECRET`

**Signature verification (required before processing):**
```typescript
import { createHmac } from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.META_APP_SECRET!)
    .update(body)
    .digest('hex')
  return `sha256=${expected}` === signature
}
```

**Body (Instagram DM payload):**
```json
{
  "entry": [{
    "messaging": [{
      "sender": { "id": "123456" },
      "recipient": { "id": "987654" },
      "timestamp": 1700000000,
      "message": { "text": "Hello, I'm interested" }
    }]
  }]
}
```

**Logic:**
1. Read raw body as string before parsing
2. Verify signature — return 403 if invalid
3. Parse JSON
4. `normaliseInstagram(payload, clientId)`
5. Find channel: `WHERE account_id = recipient.id AND type = 'instagram'`
6. Set `normalised.client_id` from channel
7. `fetch('/api/message', { method: 'POST', body: JSON.stringify(normalised) })`
8. Return `200` immediately (don't await message processing)

**Response:** `200 OK` always (even on error — Meta will retry on non-200)

---

## GET/POST `/api/webhook/whatsapp`

### GET
Same as Instagram — same META_VERIFY_TOKEN.

### POST — Inbound WhatsApp message

**Headers:**
- `X-Hub-Signature-256`: same verification

**Body (WhatsApp message payload):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "123" },
        "contacts": [{ "profile": { "name": "Amit Kumar" }, "wa_id": "919999999999" }],
        "messages": [{
          "from": "919999999999",
          "timestamp": "1700000000",
          "text": { "body": "Hello" },
          "type": "text"
        }]
      }
    }]
  }]
}
```

**Logic:**
Same as Instagram but use `normaliseWhatsApp()` and find channel by `phone_number_id`.

---

## GET/POST `/api/webhook/facebook`

Same as Instagram — same structure, same handler pattern.
Use `normaliseFacebook()` for normalisation.

---

## POST `/api/webhook/website`

No signature verification (internal).

**Body:**
```json
{
  "session_id": "abc123",
  "client_id": "uuid",
  "name": "Visitor name",
  "message": "Hello"
}
```

**Logic:**
1. Parse body
2. `normaliseWebsite(payload, payload.client_id)`
3. POST to `/api/message`
4. Return 200

---

## POST `/api/message`

**The core pipeline. Most important route in the app.**

**Auth:** None — called internally by webhook routes

**Request body:** `NormalisedMessage`

**Response:**
- Returns `{ ok: true }` immediately after saving inbound message
- All AI processing happens via `waitUntil` after response is sent

**Implementation:**
```typescript
import { waitUntil } from '@vercel/functions'

export async function POST(req: Request) {
  const normalised: NormalisedMessage = await req.json()

  // Use service role to bypass RLS (no user session)
  const supabase = createServiceRoleClient()

  try {
    // 1. Find channel → client
    const { data: channel } = await supabase
      .from('channels')
      .select('client_id, access_token, account_id')
      .eq('account_id', normalised.to.id)
      .eq('type', normalised.channel)
      .single()

    if (!channel) {
      console.error('Channel not found for', normalised.to.id)
      return Response.json({ ok: true }) // return 200 silently
    }

    // 2. Upsert lead
    const { data: lead } = await supabase
      .from('leads')
      .upsert({
        client_id: channel.client_id,
        platform_id: normalised.from.id,
        name: normalised.from.name ?? null,
        handle: normalised.from.handle ?? null,
        last_active: normalised.timestamp,
      }, { onConflict: 'client_id,platform_id' })
      .select()
      .single()

    // 3. Save inbound message
    await supabase.from('messages').insert({
      client_id: channel.client_id,
      lead_id: lead.id,
      direction: 'inbound',
      channel: normalised.channel,
      content: normalised.content,
      ai_generated: false,
      sent_at: normalised.timestamp,
    })

    // 4. Return 200 immediately
    waitUntil(processMessage({ lead, channel, normalised, supabase }))
    return Response.json({ ok: true })

  } catch (err) {
    console.error('Message pipeline error:', err)
    return Response.json({ ok: true }) // never return non-200 to Meta
  }
}

async function processMessage({ lead, channel, normalised, supabase }) {
  try {
    const [messages, clientResult, kbResult] = await Promise.all([
      supabase.from('messages').select('*')
        .eq('lead_id', lead.id)
        .order('sent_at', { ascending: true })
        .limit(10),
      supabase.from('clients').select('*').eq('id', channel.client_id).single(),
      supabase.from('knowledge_base').select('title, content')
        .eq('client_id', channel.client_id),
    ])

    const client = clientResult.data
    const reply = await generateReply({
      lead, messages: messages.data ?? [],
      client, knowledgeBase: kbResult.data ?? [],
    })

    // Save + send outbound
    await supabase.from('messages').insert({
      client_id: client.id, lead_id: lead.id,
      direction: 'outbound', channel: normalised.channel,
      content: { type: 'text', text: reply },
      ai_generated: true,
    })

    await sendViaChannel(normalised.channel, {
      recipientId: normalised.from.id,
      message: reply,
      accessToken: channel.access_token!,
    })

    // Score + update lead
    const { score, answers } = await scoreLead({ lead, messages: messages.data ?? [], client })
    await supabase.from('leads').update({
      score, answers, last_active: new Date().toISOString(),
      status: score >= 30 ? 'engaging' : lead.status,
    }).eq('id', lead.id)

    // Route
    const updatedLead = { ...lead, score, answers }
    const threshold = client.config.routing?.assignment_threshold ?? 70

    if (score >= threshold) {
      if (client.config.routing?.type === 'agent_assignment' && !lead.assigned_agent_id) {
        const agent = await assignLead({ lead: updatedLead, client, supabase })
        if (agent) await notifyAgent({ agent, lead: updatedLead, client, latestMessage: normalised.content.text ?? '' })
      }
      if (client.config.routing?.type === 'human_handoff') {
        await notifyClient({ client, lead: updatedLead, latestMessage: normalised.content.text ?? '' })
      }
    }

    // Schedule follow-up
    const firstName = (lead.name ?? 'there').split(' ')[0]
    await scheduleFollowUp({
      leadId: lead.id, clientId: client.id,
      message: `Hi ${firstName}, just checking in — still interested?`,
      delaySeconds: 72 * 60 * 60,
    })

  } catch (err) {
    console.error('processMessage error:', err)
    // Do not throw — pipeline must never crash
  }
}
```

---

## POST `/api/send`

**Auth:** Required (Supabase session)

**Request body:**
```typescript
{ leadId: string, message: string }
```

**Response:**
```typescript
{ ok: true }
```

**Errors:**
- `401` — no session
- `404` — lead not found
- `403` — lead belongs to different client

**Logic:**
```typescript
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await supabase
    .from('clients').select('*').eq('user_id', user.id).single()

  const { leadId, message } = await req.json()

  const { data: lead } = await supabase
    .from('leads').select('*, channels(*)').eq('id', leadId).single()

  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 })
  if (lead.client_id !== client.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  await sendViaChannel(lead.channel, {
    recipientId: lead.platform_id,
    message,
    accessToken: lead.channels?.access_token,
  })

  await supabase.from('messages').insert({
    client_id: client.id, lead_id: lead.id,
    direction: 'outbound', channel: lead.channel,
    content: { type: 'text', text: message },
    ai_generated: false,
  })

  return Response.json({ ok: true })
}
```

---

## POST `/api/followup`

**Auth:** QStash signature verification

**Request body:**
```typescript
{ leadId: string, clientId: string, message: string }
```

**Response:** `{ ok: true }`

**Logic:**
```typescript
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

export const POST = verifySignatureAppRouter(async (req: Request) => {
  const { leadId, clientId, message } = await req.json()

  const supabase = createServiceRoleClient()

  // Get lead's last inbound message
  const { data: lastInbound } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('lead_id', leadId)
    .eq('direction', 'inbound')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  // If lead replied recently, skip
  const scheduleTime = new Date(Date.now() - 72 * 60 * 60 * 1000)
  if (lastInbound && new Date(lastInbound.sent_at) > scheduleTime) {
    return Response.json({ ok: true, skipped: true })
  }

  // Get lead + channel
  const { data: lead } = await supabase
    .from('leads').select('*, channels(*)').eq('id', leadId).single()

  if (!lead) return Response.json({ ok: true })

  await sendViaChannel(lead.channel, {
    recipientId: lead.platform_id,
    message,
    accessToken: lead.channels?.access_token,
  })

  await supabase.from('messages').insert({
    client_id: clientId, lead_id: leadId,
    direction: 'outbound', channel: lead.channel,
    content: { type: 'text', text: message },
    ai_generated: true,
  })

  return Response.json({ ok: true })
})
```

---

## Channel send helper

Used in `/api/message`, `/api/send`, `/api/followup`:

```typescript
async function sendViaChannel(
  channel: Platform,
  { recipientId, message, accessToken, phoneNumberId }: {
    recipientId: string
    message: string
    accessToken?: string | null
    phoneNumberId?: string
  }
) {
  switch (channel) {
    case 'instagram':
      return sendInstagramMessage({ recipientId, message, accessToken: accessToken! })
    case 'whatsapp':
      return sendWhatsAppMessage({ to: recipientId, message, phoneNumberId: phoneNumberId!, accessToken: accessToken! })
    case 'facebook':
      return sendFacebookMessage({ recipientId, message, accessToken: accessToken! })
    case 'website':
      // Website: push via Supabase Realtime or SSE
      break
  }
}
```

---

## Meta API calls

### Send Instagram DM
```
POST https://graph.facebook.com/v18.0/me/messages
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "recipient": { "id": "{recipientId}" },
  "message": { "text": "{message}" },
  "messaging_type": "RESPONSE"
}
```

### Send WhatsApp message
```
POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "{to}",
  "type": "text",
  "text": { "body": "{message}" }
}
```

---

## Auth callback route

```typescript
// src/app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: client } = await supabase
        .from('clients')
        .select('onboarding_completed')
        .eq('user_id', data.user.id)
        .single()

      if (!client?.onboarding_completed) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```
