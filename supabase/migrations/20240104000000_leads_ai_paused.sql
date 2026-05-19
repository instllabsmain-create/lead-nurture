alter table public.leads
  add column if not exists ai_paused boolean not null default false;
