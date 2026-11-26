-- =====================================================================
-- WebAgent · Schema principal
-- Multi-sistema (Bookweb, Promoforia, ...), atendimento, horários e LGPD.
-- Todas as tabelas do schema public têm RLS ativado.
-- =====================================================================

-- ---------- Tipos ----------
create type public.system_role as enum ('admin', 'supervisor', 'agent');
create type public.channel_type as enum ('whatsapp', 'instagram', 'facebook', 'tiktok');
create type public.channel_status as enum ('disconnected', 'connecting', 'connected', 'error');
create type public.conversation_status as enum ('bot', 'queued', 'open', 'pending', 'resolved');
create type public.consent_status as enum ('unknown', 'opt_in', 'opt_out');
create type public.message_direction as enum ('in', 'out');
create type public.sender_type as enum ('contact', 'agent', 'bot', 'system');
create type public.message_type as enum ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'other');
create type public.message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'received');
create type public.data_request_type as enum ('access', 'correction', 'deletion', 'portability', 'revocation');
create type public.data_request_status as enum ('open', 'in_progress', 'done', 'rejected');

-- ---------- Utilitário: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Perfis ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text,
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is 'Dados do usuário do painel. is_platform_admin só pode ser alterado pelo banco (service role).';

-- Cria o perfil automaticamente. O primeiro usuário vira administrador da plataforma.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;
  insert into public.profiles (id, full_name, is_platform_admin)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_first
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Sistemas ----------
create table public.systems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 280),
  color text not null default '#2BD14A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  protocol_prefix text not null check (protocol_prefix ~ '^[A-Z0-9]{2,5}$'),
  timezone text not null default 'America/Sao_Paulo',
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger systems_updated_at before update on public.systems
  for each row execute function public.set_updated_at();

create table public.system_members (
  system_id uuid not null references public.systems (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.system_role not null default 'agent',
  created_at timestamptz not null default now(),
  primary key (system_id, user_id)
);
create index system_members_user_idx on public.system_members (user_id);

-- ---------- Funções de permissão ----------
create or replace function public.role_rank(r public.system_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r when 'admin' then 3 when 'supervisor' then 2 else 1 end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.has_system_access(p_system uuid, p_min public.system_role default 'agent')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.system_members m
        where m.system_id = p_system
          and m.user_id = (select auth.uid())
          and public.role_rank(m.role) >= public.role_rank(p_min)
      );
$$;

create or replace function public.shares_system_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.system_members a
    join public.system_members b on a.system_id = b.system_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- ---------- Configurações por sistema ----------
create table public.system_settings (
  system_id uuid primary key references public.systems (id) on delete cascade,
  welcome_enabled boolean not null default true,
  welcome_message text not null default 'Olá, {{primeiro_nome}}! Aqui é o suporte {{sistema}}. Seu protocolo é {{protocolo}}. Em instantes um atendente vai falar com você.',
  away_enabled boolean not null default true,
  away_message text not null default 'Olá, {{primeiro_nome}}! Nosso horário de atendimento é {{horario}}. Registramos sua mensagem com o protocolo {{protocolo}} e respondemos assim que voltarmos.',
  closing_enabled boolean not null default true,
  closing_message text not null default 'Atendimento encerrado. Obrigado pelo contato! Seu protocolo é {{protocolo}}.',
  opt_out_message text not null default 'Pronto. Você não vai mais receber mensagens automáticas deste número. Para voltar a receber, envie VOLTAR.',
  welcome_cooldown_minutes int not null default 720 check (welcome_cooldown_minutes between 0 and 10080),
  retention_days int not null default 730 check (retention_days between 30 and 3650),
  updated_at timestamptz not null default now()
);
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  enabled boolean not null default true,
  opens_at time not null default '08:00',
  closes_at time not null default '18:00',
  break_start time,
  break_end time,
  unique (system_id, weekday),
  check (closes_at > opens_at),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start >= opens_at and break_end <= closes_at and break_end > break_start))
);

-- system_id nulo = feriado nacional (vale para todos os sistemas)
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  system_id uuid references public.systems (id) on delete cascade,
  date date not null,
  name text not null check (char_length(name) <= 80),
  created_at timestamptz not null default now()
);
create unique index holidays_unique_idx on public.holidays (coalesce(system_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

-- Ao criar um sistema: configurações padrão, horário seg–sex 08–18 e criador como admin.
create or replace function public.handle_new_system()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.system_settings (system_id) values (new.id);
  insert into public.business_hours (system_id, weekday, enabled, opens_at, closes_at, break_start, break_end)
  select new.id, d, d between 1 and 5, '08:00', '18:00', null, null
  from generate_series(0, 6) as d;
  if new.created_by is not null then
    insert into public.system_members (system_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger on_system_created after insert on public.systems
  for each row execute function public.handle_new_system();

-- ---------- Canais (WhatsApp hoje; Instagram, Facebook, TikTok depois) ----------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  type public.channel_type not null default 'whatsapp',
  name text not null check (char_length(name) <= 60),
  provider text not null default 'evolution',
  instance_name text not null unique check (instance_name ~ '^[a-z0-9_-]{3,64}$'),
  status public.channel_status not null default 'disconnected',
  phone text,
  profile_name text,
  profile_picture_url text,
  last_status_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index channels_system_idx on public.channels (system_id);
create trigger channels_updated_at before update on public.channels
  for each row execute function public.set_updated_at();

-- Segredos do provedor (token da instância etc.). Sem policies: só o servidor (service role) lê.
create table public.channel_secrets (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Contatos ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  name text check (char_length(name) <= 120),
  push_name text,
  email text,
  avatar_url text,
  tags text[] not null default '{}',
  notes text,
  consent_status public.consent_status not null default 'unknown',
  consent_updated_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system_id, phone)
);
create index contacts_system_name_idx on public.contacts (system_id, name);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------- Protocolo de atendimento: PREFIXO-AAMMDD-NNNN ----------
create table public.protocol_counters (
  system_id uuid not null references public.systems (id) on delete cascade,
  day date not null,
  last_value int not null default 0,
  primary key (system_id, day)
);

create or replace function public.next_protocol(p_system uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_tz text;
  v_day date;
  v_seq int;
begin
  select protocol_prefix, timezone into v_prefix, v_tz from public.systems where id = p_system;
  if v_prefix is null then
    raise exception 'Sistema % não encontrado', p_system;
  end if;
  v_day := (now() at time zone v_tz)::date;
  insert into public.protocol_counters (system_id, day, last_value)
  values (p_system, v_day, 1)
  on conflict (system_id, day) do update set last_value = public.protocol_counters.last_value + 1
  returning last_value into v_seq;
  return v_prefix || '-' || to_char(v_day, 'YYMMDD') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ---------- Conversas ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  protocol text not null unique,
  status public.conversation_status not null default 'queued',
  assignee_id uuid references auth.users (id) on delete set null,
  unread_count int not null default 0,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  opened_outside_hours boolean not null default false,
  first_response_at timestamptz,
  resolved_at timestamptz,
  csat_score smallint check (csat_score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_inbox_idx on public.conversations (system_id, status, last_message_at desc);
create index conversations_contact_idx on public.conversations (contact_id);
create index conversations_assignee_idx on public.conversations (assignee_id) where assignee_id is not null;
-- Só uma conversa ativa por contato e canal
create unique index conversations_one_active_idx on public.conversations (channel_id, contact_id) where status <> 'resolved';
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------- Mensagens ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction public.message_direction not null,
  sender_type public.sender_type not null,
  sender_id uuid references auth.users (id) on delete set null,
  type public.message_type not null default 'text',
  body text,
  media_path text,
  media_mime text,
  external_id text,
  status public.message_status not null default 'queued',
  error text,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
-- Idempotência dos webhooks: a mesma mensagem do WhatsApp não entra duas vezes
create unique index messages_external_idx on public.messages (system_id, external_id) where external_id is not null;

-- ---------- Respostas rápidas ----------
create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  shortcut text not null check (shortcut ~ '^[a-z0-9_-]{2,30}$'),
  title text not null check (char_length(title) <= 60),
  body text not null check (char_length(body) <= 4096),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (system_id, shortcut)
);

-- ---------- LGPD ----------
-- Histórico imutável de consentimento (prova do opt-in / opt-out)
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status public.consent_status not null,
  source text not null check (source in ('keyword', 'agent', 'import', 'form', 'api')),
  evidence text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index consent_events_contact_idx on public.consent_events (contact_id, created_at desc);

-- Preferências de cookies do painel
create table public.cookie_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  anon_id text check (char_length(anon_id) <= 64),
  version text not null,
  necessary boolean not null default true,
  preferences boolean not null default false,
  analytics boolean not null default false,
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);

-- Pedidos do titular (art. 18 LGPD). Prazo padrão de 15 dias (art. 19, II).
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  requester_name text not null,
  requester_contact text not null,
  type public.data_request_type not null,
  status public.data_request_status not null default 'open',
  notes text,
  due_at timestamptz not null default (now() + interval '15 days'),
  resolved_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Trilha de auditoria (somente inserção pelo servidor ou pela função log_audit)
create table public.audit_logs (
  id bigint generated always as identity primary key,
  system_id uuid references public.systems (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_system_idx on public.audit_logs (system_id, created_at desc);

create or replace function public.log_audit(p_system uuid, p_action text, p_entity text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado';
  end if;
  if p_system is not null and not public.has_system_access(p_system) then
    raise exception 'Sem acesso ao sistema';
  end if;
  insert into public.audit_logs (system_id, actor_id, action, entity, entity_id, metadata)
  values (p_system, (select auth.uid()), left(p_action, 80), left(p_entity, 80), left(p_entity_id, 120), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------- Heartbeat (mantém o projeto ativo; só o servidor escreve) ----------
create table public.system_heartbeats (
  id bigint generated always as identity primary key,
  source text not null default 'worker',
  created_at timestamptz not null default now()
);
