-- Automated billing notifications: settings + queue + cron
-- 1) Tables
create extension if not exists pgcrypto;

-- Settings table per company
create table if not exists public.payment_notification_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  active boolean not null default true,
  pre_due_days integer[] not null default array[3],
  on_due boolean not null default true,
  post_due_days integer[] not null default array[2],
  send_hour time not null default time '09:00',
  template_pre_due text not null default 'Olá {{cliente}}, lembramos que seu pagamento de R$ {{valor}} vence em {{dias}} dia(s) ({{vencimento}}). Pague aqui: {{link_pagamento}}',
  template_on_due text not null default 'Olá {{cliente}}, seu pagamento de R$ {{valor}} vence hoje ({{vencimento}}). Pague aqui: {{link_pagamento}}',
  template_post_due text not null default 'Olá {{cliente}}, identificamos atraso de {{dias}} dia(s) no pagamento de R$ {{valor}} vencido em {{vencimento}}. Regularize: {{link_pagamento}}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_settings_company unique (company_id)
);

alter table public.payment_notification_settings enable row level security;

create policy "Company can view own notification settings"
  on public.payment_notification_settings
  for select
  using (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = payment_notification_settings.company_id
    )
  );

create policy "Company can insert own notification settings"
  on public.payment_notification_settings
  for insert
  with check (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = company_id
    )
  );

create policy "Company can update own notification settings"
  on public.payment_notification_settings
  for update
  using (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = payment_notification_settings.company_id
    )
  );

create trigger trg_payment_notification_settings_updated_at
before update on public.payment_notification_settings
for each row
execute function public.update_updated_at_column();

-- Notifications queue/log table
create table if not exists public.payment_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid not null references public.payment_transactions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  event_type text not null check (event_type in ('pre_due','on_due','post_due')),
  offset_days integer not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  message_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uniq_payment_notification unique (company_id, payment_id, event_type, offset_days)
);

create index if not exists idx_payment_notifications_scheduled_for
  on public.payment_notifications (status, scheduled_for);

create index if not exists idx_payment_transactions_due
  on public.payment_transactions (company_id, due_date, status);

alter table public.payment_notifications enable row level security;

create policy "Company can view own payment notifications"
  on public.payment_notifications
  for select
  using (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = payment_notifications.company_id
    )
  );

create policy "Company can insert own payment notifications"
  on public.payment_notifications
  for insert
  with check (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = company_id
    )
  );

create policy "Company can update own payment notifications"
  on public.payment_notifications
  for update
  using (
    exists (
      select 1 from public.profiles p 
      where p.user_id = auth.uid() 
        and p.company_id = payment_notifications.company_id
    )
  );

create trigger trg_payment_notifications_updated_at
before update on public.payment_notifications
for each row
execute function public.update_updated_at_column();

-- Create default settings for existing companies (idempotent)
insert into public.payment_notification_settings (company_id)
select c.id from public.companies c
on conflict (company_id) do nothing;

-- 2) Scheduler (pg_cron + pg_net) to invoke edge function every 15 minutes
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Drop previous job if exists to avoid duplicates
select cron.unschedule('billing-notifications-every-15-min')
where exists (
  select 1 from cron.job where jobname = 'billing-notifications-every-15-min'
);

select
  cron.schedule(
    'billing-notifications-every-15-min',
    '*/15 * * * *',
    $$
    select
      net.http_post(
        url := 'https://mcdidffxwtnqhawqilln.supabase.co/functions/v1/billing-notifications',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZGlkZmZ4d3RucWhhd3FpbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MTQ2ODEsImV4cCI6MjA3MTk5MDY4MX0.v2VSArebudz3nJsblgqlRJB4dOt7VQGTwSEO1M32waw"}'::jsonb,
        body := '{"trigger": "cron"}'::jsonb
      ) as request_id;
    $$
  );