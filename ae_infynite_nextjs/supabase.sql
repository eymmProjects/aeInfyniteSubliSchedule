create table if not exists public.schedules (
  month_key text primary key check (month_key ~ '^\\d{4}-\\d{2}$'),
  payload jsonb not null default '{"days":{},"orders":[],"notes":""}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.schedules enable row level security;
-- No public policies. The Next.js server route uses the private service-role key.
