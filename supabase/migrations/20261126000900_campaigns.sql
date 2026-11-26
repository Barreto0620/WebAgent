-- =====================================================================
-- Campanhas: envio para contatos com consentimento (opt-in), com
-- intervalo aleatório, janela de horário e limite diário.
-- =====================================================================
create type public.campaign_status as enum ('draft', 'scheduled', 'running', 'paused', 'completed', 'canceled');
create type public.recipient_status as enum ('pending', 'sent', 'failed', 'skipped');

-- Origem da conversa: separa campanhas das métricas de atendimento
alter table public.conversations add column origin text not null default 'inbound' check (origin in ('inbound', 'agent', 'campaign'));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  message text not null check (char_length(message) between 2 and 3000),
  audience_tags text[] not null default '{}',
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  min_interval_s int not null default 20 check (min_interval_s between 5 and 600),
  max_interval_s int not null default 60 check (max_interval_s between 5 and 900),
  daily_limit int not null default 200 check (daily_limit between 1 and 2000),
  window_start time not null default '09:00',
  window_end time not null default '20:00',
  total int not null default 0,
  sent int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_interval_s >= min_interval_s),
  check (window_end > window_start)
);
create index campaigns_system_idx on public.campaigns (system_id, created_at desc);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  system_id uuid not null references public.systems (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status public.recipient_status not null default 'pending',
  message_id uuid references public.messages (id) on delete set null,
  error text,
  sent_at timestamptz,
  unique (campaign_id, contact_id)
);
create index campaign_recipients_pending_idx on public.campaign_recipients (campaign_id) where status = 'pending';

alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

create policy "campaigns: membros veem" on public.campaigns
  for select to authenticated using (private.has_system_access(system_id));
create policy "campaigns: supervisor cria" on public.campaigns
  for insert to authenticated
  with check (private.has_system_access(system_id, 'supervisor') and created_by = (select auth.uid()) and status = 'draft');
-- Rascunhos são editáveis pelo painel; iniciar/pausar/cancelar passa pela API
create policy "campaigns: supervisor edita rascunho" on public.campaigns
  for update to authenticated
  using (private.has_system_access(system_id, 'supervisor') and status = 'draft')
  with check (private.has_system_access(system_id, 'supervisor') and status = 'draft');
create policy "campaigns: supervisor exclui rascunho" on public.campaigns
  for delete to authenticated
  using (private.has_system_access(system_id, 'supervisor') and status in ('draft', 'canceled', 'completed'));

create policy "recipients: membros veem" on public.campaign_recipients
  for select to authenticated using (private.has_system_access(system_id));

alter publication supabase_realtime add table public.campaigns;
