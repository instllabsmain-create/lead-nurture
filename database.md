# Database
> Full Supabase schema. Paste into SQL editor or save as migration file.

---

## Migration file

Save as: `supabase/migrations/20240101000000_initial_schema.sql`
Run with: `supabase db push`

```sql
-- Enable vector extension for knowledge base (Phase 2)
create extension if not exists vector;

-- ────────────────────────────────────────────────
-- CLIENTS
-- Your customers — one row per MSME business
-- ────────────────────────────────────────────────
create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade unique,
  name                  text not null,
  email                 text unique not null,
  plan                  text default 'starter',
  onboarding_completed  boolean default false,
  config                jsonb default '{}',
  created_at            timestamptz default now()
);

-- ────────────────────────────────────────────────
-- CHANNELS
-- Connected messaging platforms per client
-- ────────────────────────────────────────────────
create table public.channels (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  type          text not null,
  -- 'instagram' | 'whatsapp' | 'facebook' | 'website'
  account_id    text,
  -- platform's ID for their account (page ID, phone number ID, etc.)
  account_name  text,
  -- display name shown in dashboard
  access_token  text,
  -- store encrypted in production
  status        text default 'active',
  -- 'active' | 'expired' | 'disconnected'
  connected_at  timestamptz default now()
);

-- ────────────────────────────────────────────────
-- AGENTS
-- Client's sales team members
-- ────────────────────────────────────────────────
create table public.agents (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id) on delete cascade,
  name            text not null,
  phone           text,
  -- for WhatsApp notifications
  email           text,
  territories     jsonb default '[]',
  -- string[] — areas/locations this agent handles
  specialities    jsonb default '[]',
  -- string[] — product types or services this agent handles
  max_leads       int default 10,
  -- maximum concurrent active leads
  active_leads    int default 0,
  -- current count — incremented on assignment
  is_available    boolean default true,
  working_hours   jsonb default '{}',
  -- { mon: { start: 9, end: 18 }, tue: ..., ... }
  created_at      timestamptz default now()
);

-- ────────────────────────────────────────────────
-- LEADS
-- People who have messaged a client
-- ────────────────────────────────────────────────
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references public.clients(id) on delete cascade,
  channel_id          uuid references public.channels(id),
  platform_id         text not null,
  -- their ID on the platform (Instagram user ID, WhatsApp phone, etc.)
  name                text,
  handle              text,
  avatar              text,
  phone               text,
  email               text,
  score               int default 0,
  -- 0-100, drives routing
  status              text default 'new',
  -- 'new' | 'engaging' | 'qualified' | 'unqualified' | 'assigned' | 'closed'
  answers             jsonb default '{}',
  -- Record<question, answer> — qualification answers extracted by AI
  tags                jsonb default '[]',
  -- string[] — manual tags added by client
  assigned_agent_id   uuid references public.agents(id),
  assigned_at         timestamptz,
  first_seen          timestamptz default now(),
  last_active         timestamptz default now(),
  unique(client_id, platform_id)
  -- one lead per platform per client — upsert on this
);

-- ────────────────────────────────────────────────
-- MESSAGES
-- Every message in every conversation
-- ────────────────────────────────────────────────
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  direction     text not null,
  -- 'inbound' (from lead) | 'outbound' (AI or human reply)
  channel       text not null,
  -- 'instagram' | 'whatsapp' | 'facebook' | 'website'
  content       jsonb not null,
  -- { type: 'text'|'image'|'audio', text?: string, url?: string }
  ai_generated  boolean default false,
  -- true = AI wrote this, false = human agent
  sent_at       timestamptz default now()
);

-- ────────────────────────────────────────────────
-- KNOWLEDGE BASE
-- Business info the AI uses to answer questions
-- ────────────────────────────────────────────────
create table public.knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  title       text,
  -- optional, e.g. "Pricing" or "Delivery policy"
  content     text not null,
  embedding   vector(1536),
  -- Phase 2: for semantic search via pgvector
  created_at  timestamptz default now()
);

-- ────────────────────────────────────────────────
-- FOLLOW UPS
-- Scheduled follow-up messages
-- ────────────────────────────────────────────────
create table public.follow_ups (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  message       text not null,
  scheduled_at  timestamptz not null,
  sent          boolean default false,
  sent_at       timestamptz,
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────────────
-- BROADCASTS (Phase 2)
-- Proactive bulk messages to leads
-- ────────────────────────────────────────────────
create table public.broadcasts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references public.clients(id) on delete cascade,
  name              text,
  channel           text,
  message_template  text,
  audience          jsonb default '{}',
  -- { status?: string[], score_min?: number, tags?: string[], all?: boolean }
  status            text default 'draft',
  -- 'draft' | 'scheduled' | 'sending' | 'sent'
  scheduled_at      timestamptz,
  sent_count        int default 0,
  created_at        timestamptz default now()
);

-- ────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Clients can only see their own data
-- ────────────────────────────────────────────────
alter table public.clients       enable row level security;
alter table public.channels      enable row level security;
alter table public.agents        enable row level security;
alter table public.leads         enable row level security;
alter table public.messages      enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.follow_ups    enable row level security;
alter table public.broadcasts    enable row level security;

-- Clients: users can only see/edit their own client row
create policy "own_client"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- All other tables: data is visible only to the client it belongs to
create policy "client_isolation" on public.channels
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.agents
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.leads
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.messages
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.knowledge_base
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.follow_ups
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

create policy "client_isolation" on public.broadcasts
  for all using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

-- ────────────────────────────────────────────────
-- INDEXES
-- Performance for common queries
-- ────────────────────────────────────────────────
create index idx_leads_client_status
  on public.leads(client_id, status);

create index idx_leads_client_score
  on public.leads(client_id, score desc);

create index idx_leads_client_active
  on public.leads(client_id, last_active desc);

create index idx_messages_lead_time
  on public.messages(lead_id, sent_at asc);

create index idx_messages_client_direction
  on public.messages(client_id, direction, sent_at desc);

create index idx_followups_scheduled
  on public.follow_ups(scheduled_at)
  where sent = false;

create index idx_channels_account
  on public.channels(account_id, type);
-- Used to find client from webhook payload
```

---

## TypeScript types

File: `src/types/index.ts`

```typescript
// ── Platform types ─────────────────────────────────────
export type Platform = 'instagram' | 'whatsapp' | 'facebook' | 'website'
export type LeadStatus = 'new' | 'engaging' | 'qualified' | 'unqualified' | 'assigned' | 'closed'
export type MessageDirection = 'inbound' | 'outbound'
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent'
export type RoutingType = 'human_handoff' | 'agent_assignment' | 'round_robin'

// ── Client config ──────────────────────────────────────
export interface RoutingConfig {
  type: RoutingType
  assignment_threshold?: number
  handoff_triggers?: string[]
  notify_via?: ('whatsapp' | 'email')[]
  accept_timeout_minutes?: number
  fallback?: 'reassign' | 'notify_owner'
}

export interface AIConfig {
  system_prompt?: string
  model?: string
  language?: 'en' | 'hi' | 'hinglish' | 'auto'
  response_delay_seconds?: number
}

export interface ClientConfig {
  business_description?: string
  business_type?: string[]
  ideal_customer?: string
  customer_sources?: string[]
  qualification_questions?: string[]
  scoring?: {
    question_answered?: number
    buying_signal?: number
    urgency_signal?: number
    negative_signal?: number
  }
  routing?: RoutingConfig
  ai?: AIConfig
  disabled_features?: string[]
}

// ── Main entities ──────────────────────────────────────
export interface Client {
  id: string
  user_id: string
  name: string
  email: string
  plan: string
  onboarding_completed: boolean
  config: ClientConfig
  created_at: string
}

export interface Channel {
  id: string
  client_id: string
  type: Platform
  account_id: string | null
  account_name: string | null
  access_token: string | null
  status: 'active' | 'expired' | 'disconnected'
  connected_at: string
}

export interface Agent {
  id: string
  client_id: string
  name: string
  phone: string | null
  email: string | null
  territories: string[]
  specialities: string[]
  max_leads: number
  active_leads: number
  is_available: boolean
  working_hours: Record<string, { start: number; end: number }>
  created_at: string
}

export interface Lead {
  id: string
  client_id: string
  channel_id: string | null
  platform_id: string
  name: string | null
  handle: string | null
  avatar: string | null
  phone: string | null
  email: string | null
  score: number
  status: LeadStatus
  answers: Record<string, string>
  tags: string[]
  assigned_agent_id: string | null
  assigned_at: string | null
  first_seen: string
  last_active: string
}

export interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'document'
  text?: string
  url?: string
  caption?: string
}

export interface Message {
  id: string
  client_id: string
  lead_id: string
  direction: MessageDirection
  channel: Platform
  content: MessageContent
  ai_generated: boolean
  sent_at: string
}

export interface KnowledgeBase {
  id: string
  client_id: string
  title: string | null
  content: string
  created_at: string
}

export interface FollowUp {
  id: string
  client_id: string
  lead_id: string
  message: string
  scheduled_at: string
  sent: boolean
  sent_at: string | null
  created_at: string
}

export interface Broadcast {
  id: string
  client_id: string
  name: string | null
  channel: Platform
  message_template: string | null
  audience: {
    status?: LeadStatus[]
    score_min?: number
    tags?: string[]
    all?: boolean
  }
  status: BroadcastStatus
  scheduled_at: string | null
  sent_count: number
  created_at: string
}

// ── Internal types ─────────────────────────────────────
export interface NormalisedMessage {
  client_id: string
  channel: Platform
  direction: MessageDirection
  from: {
    id: string
    name?: string
    handle?: string
  }
  to: {
    id: string
  }
  content: MessageContent
  timestamp: string
  raw: Record<string, any>
}
```

---

## Common queries

### Find client by user session
```typescript
const { data: client } = await supabase
  .from('clients')
  .select('*')
  .eq('user_id', user.id)
  .single()
```

### Find client by channel account ID (in webhook)
```typescript
const { data: channel } = await supabase
  .from('channels')
  .select('client_id, access_token, account_id')
  .eq('account_id', accountId)
  .eq('type', platform)
  .eq('status', 'active')
  .single()
```

### Upsert lead (create or update on duplicate)
```typescript
const { data: lead } = await supabase
  .from('leads')
  .upsert({
    client_id: clientId,
    platform_id: normalisedMsg.from.id,
    name: normalisedMsg.from.name ?? null,
    handle: normalisedMsg.from.handle ?? null,
    last_active: new Date().toISOString(),
  }, {
    onConflict: 'client_id,platform_id',
    ignoreDuplicates: false,
  })
  .select()
  .single()
```

### Get last N messages for lead
```typescript
const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .eq('lead_id', lead.id)
  .order('sent_at', { ascending: true })
  .limit(10)
```

### Get all leads for client with latest message
```typescript
const { data: leads } = await supabase
  .from('leads')
  .select(`
    *,
    messages (
      content,
      direction,
      sent_at
    )
  `)
  .eq('client_id', client.id)
  .order('last_active', { ascending: false })
```

### Get available agents for assignment
```typescript
const { data: agents } = await supabase
  .from('agents')
  .select('*')
  .eq('client_id', client.id)
  .eq('is_available', true)
```
