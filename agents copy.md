# Agents
> The AI engine, lead scoring engine, and agent assignment engine.
> Everything that makes decisions lives here.

---

## Overview

Three interconnected engines run after every inbound message:

```
Inbound message
      ↓
AI Engine → generates reply
      ↓
Scoring Engine → updates lead score
      ↓
Assignment Engine → routes lead to agent (if threshold crossed)
```

---

## File 1 — `src/lib/prompts.ts`

All prompts live here. Never hardcode a prompt anywhere else.

### `buildPrompt` function

```typescript
export function buildPrompt({
  client,
  lead,
  messages,
  knowledgeBase,
}: {
  client: Client
  lead: Lead
  messages: Message[]
  knowledgeBase: KnowledgeBase[]
}): string
```

### Prompt template

```
You are a sales assistant for {client.name}, an Indian business.

ABOUT THIS BUSINESS:
{client.config.business_description}

{if knowledgeBase.length > 0}
BUSINESS KNOWLEDGE (use this to answer questions accurately):
{knowledgeBase.map(k => `${k.title ? k.title + ': ' : ''}${k.content}`).join('\n\n')}
{endif}

YOUR JOB:
- Reply warmly and naturally in {language}
- You are qualifying this lead by asking questions to understand their needs
- Questions to ask (ask only ONE per reply, and only if not already answered):
  {client.config.qualification_questions.map((q, i) => `${i+1}. ${q}`).join('\n')}
- Already answered by this lead (DO NOT ask these again):
  {Object.entries(lead.answers).map(([q,a]) => `  ${q}: ${a}`).join('\n') || '  (none yet)'}
- If the lead seems ready to buy, is asking about pricing/next steps, or their score is high:
  suggest they speak with the team or that someone will follow up with them directly
- If you don't know something: say you'll check and get back to them
- Never make up prices, dates, or facts not in the knowledge base

TONE RULES:
- Warm and helpful, not salesy or pushy
- Sound like a real person who works there, not a corporate template
- Max 2-3 short sentences per reply
- Match the language and formality of the lead

LANGUAGE: {language}

Now reply to the lead's latest message.
```

### Language detection

```typescript
function getLanguage(client: Client): string {
  const lang = client.config.ai?.language ?? 'auto'
  if (lang === 'auto') {
    return 'Match the language the lead is using — English, Hindi, or Hinglish'
  }
  return lang
}
```

---

## File 2 — `src/lib/ai.ts`

### `generateReply` function

```typescript
export async function generateReply({
  lead,
  messages,
  client,
  knowledgeBase,
}: {
  lead: Lead
  messages: Message[]
  client: Client
  knowledgeBase: KnowledgeBase[]
}): Promise<string>
```

### Implementation

```typescript
export async function generateReply({ lead, messages, client, knowledgeBase }) {
  const systemPrompt = buildPrompt({ client, lead, messages, knowledgeBase })

  // Last 10 messages as conversation history
  const history = messages.slice(-10).map(m => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.content.text ?? ''
  }))

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: client.config.ai?.model ?? 'google/gemini-flash-1.5',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter error: ${res.statusText}`)

  const data = await res.json()
  return data.choices[0].message.content.trim()
}
```

---

## File 3 — `src/lib/score.ts`

### `scoreLead` function

```typescript
export async function scoreLead({
  lead,
  messages,
  client,
}: {
  lead: Lead
  messages: Message[]
  client: Client
}): Promise<{
  score: number
  answers: Record<string, string>
}>
```

### Implementation

```typescript
export async function scoreLead({ lead, messages, client }) {
  const weights = {
    question_answered: 10,
    buying_signal: 15,
    urgency_signal: 20,
    negative_signal: -20,
    ...client.config.scoring,
  }

  let score = lead.score
  const answers = { ...lead.answers }

  // Get latest inbound message
  const latestInbound = [...messages]
    .reverse()
    .find(m => m.direction === 'inbound')
  if (!latestInbound?.content.text) return { score, answers }

  const text = latestInbound.content.text.toLowerCase()
  const questions = client.config.qualification_questions ?? DEFAULT_CONFIG.qualification_questions

  // Check if latest message answers any unanswered questions
  for (const question of questions) {
    if (answers[question]) continue // already answered
    if (messageAnswersQuestion(text, question)) {
      answers[question] = latestInbound.content.text
      score += weights.question_answered
    }
  }

  // Detect signals
  const buyingSignals = ['interested', 'want to buy', 'how much', 'price', 'cost',
    'when can', 'available', 'book', 'purchase', 'order', 'buy']
  const urgencySignals = ['urgent', 'asap', 'today', 'this week', 'immediately',
    'quickly', 'soon', 'need now', 'right now']
  const negativeSignals = ['not interested', 'no thanks', 'too expensive',
    'just browsing', 'maybe later', 'not now', 'cancel', 'stop']

  if (buyingSignals.some(s => text.includes(s))) score += weights.buying_signal
  if (urgencySignals.some(s => text.includes(s))) score += weights.urgency_signal
  if (negativeSignals.some(s => text.includes(s))) score += weights.negative_signal

  // Cap
  score = Math.max(0, Math.min(100, score))

  return { score, answers }
}

function messageAnswersQuestion(text: string, question: string): boolean {
  // Simple heuristic: if the message has 3+ words and mentions
  // keywords from the question, treat as an answer
  const keywords = question.toLowerCase()
    .split(' ')
    .filter(w => w.length > 3)
  return text.length > 15 && keywords.some(k => text.includes(k))
}
```

---

## File 4 — `src/lib/assign.ts`

### `assignLead` function

```typescript
export async function assignLead({
  lead,
  client,
  supabase,
}: {
  lead: Lead
  client: Client
  supabase: SupabaseClient
}): Promise<Agent | null>
```

### Implementation

```typescript
export async function assignLead({ lead, client, supabase }) {
  // Guard clauses
  if (client.config.routing?.type !== 'agent_assignment') return null
  const threshold = client.config.routing?.assignment_threshold ?? 70
  if (lead.score < threshold) return null
  if (lead.assigned_agent_id !== null) return null

  // Get available agents
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('client_id', client.id)
    .eq('is_available', true)

  const available = (agents ?? []).filter(a => a.active_leads < a.max_leads)
  if (!available.length) return null

  // Territory filter
  const locationAnswer = Object.values(lead.answers).find(a => a.length > 0)
  let pool = available
  if (locationAnswer) {
    const territoryMatch = available.filter(a =>
      a.territories.length === 0 ||
      a.territories.some((t: string) =>
        locationAnswer.toLowerCase().includes(t.toLowerCase())
      )
    )
    if (territoryMatch.length > 0) pool = territoryMatch
  }

  // Sort by load
  const sorted = pool.sort((a, b) => a.active_leads - b.active_leads)

  // Select
  const agent = lead.score > 85
    ? sorted[0]
    : sorted[Math.floor(Date.now() / 1000) % sorted.length]

  // Update DB
  await Promise.all([
    supabase.from('leads').update({
      assigned_agent_id: agent.id,
      assigned_at: new Date().toISOString(),
      status: 'assigned',
    }).eq('id', lead.id),

    supabase.from('agents').update({
      active_leads: agent.active_leads + 1,
    }).eq('id', agent.id),
  ])

  return agent
}
```

---

## File 5 — `src/lib/notify.ts`

### `notifyAgent` function

```typescript
export async function notifyAgent({
  agent,
  lead,
  client,
  latestMessage,
}: {
  agent: Agent
  lead: Lead
  client: Client
  latestMessage: string
}): Promise<void> {
  const answersText = Object.entries(lead.answers)
    .map(([q, a]) => `• ${q}: ${a}`)
    .join('\n')

  const message = `🔥 New lead assigned to you

Name: ${lead.name ?? lead.handle ?? 'Unknown'}
Score: ${lead.score}/100
Channel: ${lead.channel ?? 'unknown'}
Last message: "${latestMessage}"

${answersText ? `Answers collected:\n${answersText}\n` : ''}
View conversation:
${process.env.NEXT_PUBLIC_APP_URL}/inbox/${lead.id}`

  if (agent.phone) {
    const channel = await getClientWhatsAppChannel(client.id)
    if (channel) {
      await sendWhatsAppMessage({
        to: agent.phone,
        message,
        phoneNumberId: channel.account_id!,
        accessToken: channel.access_token!,
      })
      return
    }
  }

  // Email fallback
  if (agent.email) {
    await sendEmail({
      to: agent.email,
      subject: `New lead assigned: ${lead.name ?? lead.handle}`,
      text: message,
    })
  }
}
```

### `notifyClient` function (human handoff)

```typescript
export async function notifyClient({
  client,
  lead,
  latestMessage,
}: {
  client: Client
  lead: Lead
  latestMessage: string
}): Promise<void> {
  const notifyVia = client.config.routing?.notify_via ?? ['whatsapp']

  const message = `👋 Hot lead ready for you

Name: ${lead.name ?? lead.handle ?? 'Unknown'}
Score: ${lead.score}/100
Channel: ${lead.channel ?? 'unknown'}

They said: "${latestMessage}"

Pick up the conversation:
${process.env.NEXT_PUBLIC_APP_URL}/inbox/${lead.id}`

  if (notifyVia.includes('whatsapp')) {
    // Send to client's own phone via their WhatsApp channel
    // client.phone needs to be in clients table or config
  }

  if (notifyVia.includes('email')) {
    await sendEmail({
      to: client.email,
      subject: `Hot lead: ${lead.name ?? lead.handle}`,
      text: message,
    })
  }
}
```

---

## File 6 — `src/lib/normalise.ts`

### Four normalise functions

All return `NormalisedMessage`. Direction is always `'inbound'`.

```typescript
export function normaliseInstagram(payload: any, clientId: string): NormalisedMessage {
  const msg = payload.entry[0].messaging[0]
  return {
    client_id: clientId,
    channel: 'instagram',
    direction: 'inbound',
    from: { id: msg.sender.id },
    to: { id: msg.recipient.id },
    content: { type: 'text', text: msg.message?.text ?? '' },
    timestamp: new Date(msg.timestamp * 1000).toISOString(),
    raw: payload,
  }
}

export function normaliseWhatsApp(payload: any, clientId: string): NormalisedMessage {
  const value = payload.entry[0].changes[0].value
  const message = value.messages[0]
  const contact = value.contacts[0]
  return {
    client_id: clientId,
    channel: 'whatsapp',
    direction: 'inbound',
    from: {
      id: message.from,
      name: contact?.profile?.name,
    },
    to: { id: value.metadata.phone_number_id },
    content: { type: 'text', text: message.text?.body ?? '' },
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    raw: payload,
  }
}

export function normaliseFacebook(payload: any, clientId: string): NormalisedMessage {
  // Same structure as Instagram
  return normaliseInstagram(payload, clientId)
}

export function normaliseWebsite(payload: any, clientId: string): NormalisedMessage {
  return {
    client_id: clientId,
    channel: 'website',
    direction: 'inbound',
    from: { id: payload.session_id, name: payload.name },
    to: { id: clientId },
    content: { type: 'text', text: payload.message ?? '' },
    timestamp: new Date().toISOString(),
    raw: payload,
  }
}
```

---

## File 7 — `src/lib/queue.ts`

```typescript
import { Client as QStash } from '@upstash/qstash'

const qstash = new QStash({ token: process.env.QSTASH_TOKEN! })

export async function scheduleFollowUp({
  leadId,
  clientId,
  message,
  delaySeconds,
}: {
  leadId: string
  clientId: string
  message: string
  delaySeconds: number
}): Promise<void> {
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/followup`,
    delay: delaySeconds,
    body: { leadId, clientId, message },
  })
}
```
