-- Safe idempotent setup script — paste into Supabase SQL Editor
-- Run this on any blank project to create the full schema.

-- Vector extension (only needed for semantic search — optional)
create extension if not exists vector;

-- ── CLIENTS ──────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade unique,
  name                 text not null,
  email                text unique not null,
  plan                 text default 'starter',
  onboarding_completed boolean default false,
  config               jsonb default '{}',
  created_at           timestamptz default now()
);

-- ── CHANNELS ─────────────────────────────────────────────────────────────────
create table if not exists public.channels (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  type         text not null,
  account_id   text,
  account_name text,
  access_token text,
  status       text default 'active',
  connected_at timestamptz default now()
);

-- ── AGENTS ───────────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  name          text not null,
  phone         text,
  email         text,
  territories   jsonb default '[]',
  specialities  jsonb default '[]',
  max_leads     int default 10,
  active_leads  int default 0,
  is_available  boolean default true,
  working_hours jsonb default '{}',
  created_at    timestamptz default now()
);

-- ── LEADS ────────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references public.clients(id) on delete cascade,
  channel_id        uuid references public.channels(id),
  platform_id       text not null,
  name              text,
  handle            text,
  avatar            text,
  phone             text,
  email             text,
  score             int default 0,
  status            text default 'new',
  answers           jsonb default '{}',
  tags              jsonb default '[]',
  assigned_agent_id uuid references public.agents(id),
  assigned_at       timestamptz,
  ai_paused         boolean not null default false,
  first_seen        timestamptz default now(),
  last_active       timestamptz default now(),
  unique (client_id, platform_id)
);

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete cascade,
  direction    text not null,
  channel      text not null,
  content      jsonb not null,
  ai_generated boolean default false,
  sent_at      timestamptz default now()
);

-- ── KNOWLEDGE BASE ───────────────────────────────────────────────────────────
create table if not exists public.knowledge_base (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients(id) on delete cascade,
  title      text,
  content    text not null,
  created_at timestamptz default now()
);

-- Add vector embedding column only if pgvector loaded successfully
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    alter table public.knowledge_base
      add column if not exists embedding vector(1536);
  end if;
end $$;

-- ── FOLLOW UPS ───────────────────────────────────────────────────────────────
create table if not exists public.follow_ups (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete cascade,
  message      text not null,
  scheduled_at timestamptz not null,
  sent         boolean default false,
  sent_at      timestamptz,
  created_at   timestamptz default now()
);

-- ── BROADCASTS ───────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete cascade,
  name             text,
  channel          text,
  message_template text,
  audience         jsonb default '{}',
  status           text default 'draft',
  scheduled_at     timestamptz,
  sent_count       int default 0,
  created_at       timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.clients        enable row level security;
alter table public.channels       enable row level security;
alter table public.agents         enable row level security;
alter table public.leads          enable row level security;
alter table public.messages       enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.broadcasts     enable row level security;

-- Drop and recreate policies so this script is safe to re-run
do $$ declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and policyname in ('own_client', 'client_isolation')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "own_client" on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "client_isolation" on public.channels for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.agents for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.leads for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.messages for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.knowledge_base for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.follow_ups for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "client_isolation" on public.broadcasts for all
  using (client_id in (select id from public.clients where user_id = auth.uid()));

-- ── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_leads_client_status   on public.leads(client_id, status);
create index if not exists idx_leads_client_score    on public.leads(client_id, score desc);
create index if not exists idx_leads_client_active   on public.leads(client_id, last_active desc);
create index if not exists idx_messages_lead_time    on public.messages(lead_id, sent_at asc);
create index if not exists idx_messages_client_dir   on public.messages(client_id, direction, sent_at desc);
create index if not exists idx_followups_scheduled   on public.follow_ups(scheduled_at) where sent = false;
create index if not exists idx_channels_account      on public.channels(account_id, type);
create index if not exists idx_leads_agent           on public.leads(client_id, assigned_agent_id) where assigned_agent_id is not null;

-- ── WAITLIST (marketing site) ─────────────────────────────────────────────────
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  business   text not null,
  whatsapp   text not null,
  industry   text,
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join waitlist" on public.waitlist;
create policy "Anyone can join waitlist" on public.waitlist
  for insert with check (true);
