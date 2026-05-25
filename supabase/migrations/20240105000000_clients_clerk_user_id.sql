alter table public.clients
  add column if not exists clerk_user_id text;

create unique index if not exists idx_clients_clerk_user_id
  on public.clients(clerk_user_id)
  where clerk_user_id is not null;
