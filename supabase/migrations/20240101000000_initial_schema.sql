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
