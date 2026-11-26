-- =====================================================================
-- Campanhas de leads a partir de planilha (arquivo ou link compartilhado)
-- =====================================================================
alter table public.campaigns
  add column kind text not null default 'optin' check (kind in ('optin', 'leads')),
  add column source_name text,
  add column source_url text,
  add column mapping jsonb not null default '{}'::jsonb,
  add column respect_day boolean not null default true,
  add column followups_enabled boolean not null default false,
  add column append_optout boolean not null default true,
  add column replied int not null default 0,
  add column opted_out int not null default 0;

-- Para leads a mensagem vem de cada linha; para opt-in continua obrigatória
alter table public.campaigns drop constraint campaigns_message_check;
alter table public.campaigns add constraint campaigns_message_check check (char_length(message) <= 3000);

alter table public.campaign_recipients
  add column lead_name text,
  add column message text,
  add column followups jsonb not null default '[]'::jsonb,
  add column row_data jsonb not null default '{}'::jsonb,
  add column send_after timestamptz,
  add column step int not null default 0,
  add column next_at timestamptz,
  add column last_sent_at timestamptz,
  add column replied_at timestamptz;

create index campaign_recipients_due_idx on public.campaign_recipients (campaign_id, next_at) where replied_at is null and next_at is not null;
create index campaign_recipients_contact_idx on public.campaign_recipients (contact_id) where replied_at is null;
create index campaign_recipients_sentday_idx on public.campaign_recipients (system_id, last_sent_at);
