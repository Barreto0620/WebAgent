-- =====================================================================
-- WebAgent · Row Level Security
-- Regra geral: cada usuário só enxerga os sistemas dos quais é membro.
-- Administrador da plataforma enxerga tudo.
-- O servidor (API/worker) usa a service role e não passa por RLS.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.systems enable row level security;
alter table public.system_members enable row level security;
alter table public.system_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.holidays enable row level security;
alter table public.channels enable row level security;
alter table public.channel_secrets enable row level security;
alter table public.contacts enable row level security;
alter table public.protocol_counters enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.quick_replies enable row level security;
alter table public.consent_events enable row level security;
alter table public.cookie_consents enable row level security;
alter table public.data_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_heartbeats enable row level security;

-- channel_secrets, protocol_counters e system_heartbeats: sem policies (só service role).

-- ---------- profiles ----------
create policy "profiles: ver o próprio e colegas" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_platform_admin() or public.shares_system_with(id));

create policy "profiles: editar o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Impede que o usuário se promova: só estas colunas podem ser alteradas pelo painel.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, theme) on public.profiles to authenticated;

-- ---------- systems ----------
create policy "systems: membros veem" on public.systems
  for select to authenticated
  using (public.has_system_access(id));

create policy "systems: admin da plataforma cria" on public.systems
  for insert to authenticated
  with check (public.is_platform_admin() and created_by = (select auth.uid()));

create policy "systems: admin do sistema edita" on public.systems
  for update to authenticated
  using (public.has_system_access(id, 'admin'))
  with check (public.has_system_access(id, 'admin'));

create policy "systems: admin da plataforma exclui" on public.systems
  for delete to authenticated
  using (public.is_platform_admin());

-- ---------- system_members ----------
create policy "members: membros veem" on public.system_members
  for select to authenticated
  using (public.has_system_access(system_id));

create policy "members: admin gerencia (insert)" on public.system_members
  for insert to authenticated
  with check (public.has_system_access(system_id, 'admin'));

create policy "members: admin gerencia (update)" on public.system_members
  for update to authenticated
  using (public.has_system_access(system_id, 'admin'))
  with check (public.has_system_access(system_id, 'admin'));

create policy "members: admin gerencia (delete)" on public.system_members
  for delete to authenticated
  using (public.has_system_access(system_id, 'admin'));

-- ---------- system_settings / business_hours ----------
create policy "settings: membros veem" on public.system_settings
  for select to authenticated using (public.has_system_access(system_id));
create policy "settings: supervisor edita" on public.system_settings
  for update to authenticated
  using (public.has_system_access(system_id, 'supervisor'))
  with check (public.has_system_access(system_id, 'supervisor'));

create policy "hours: membros veem" on public.business_hours
  for select to authenticated using (public.has_system_access(system_id));
create policy "hours: supervisor edita" on public.business_hours
  for update to authenticated
  using (public.has_system_access(system_id, 'supervisor'))
  with check (public.has_system_access(system_id, 'supervisor'));

-- ---------- holidays ----------
create policy "holidays: ver nacionais e do sistema" on public.holidays
  for select to authenticated
  using (system_id is null or public.has_system_access(system_id));
create policy "holidays: supervisor cria" on public.holidays
  for insert to authenticated
  with check (
    (system_id is null and public.is_platform_admin())
    or (system_id is not null and public.has_system_access(system_id, 'supervisor'))
  );
create policy "holidays: supervisor exclui" on public.holidays
  for delete to authenticated
  using (
    (system_id is null and public.is_platform_admin())
    or (system_id is not null and public.has_system_access(system_id, 'supervisor'))
  );

-- ---------- channels ----------
-- Conectar/desconectar passa pela API (que fala com a Evolution); o painel só lê e renomeia.
create policy "channels: membros veem" on public.channels
  for select to authenticated using (public.has_system_access(system_id));
create policy "channels: admin renomeia" on public.channels
  for update to authenticated
  using (public.has_system_access(system_id, 'admin'))
  with check (public.has_system_access(system_id, 'admin'));
revoke update on public.channels from authenticated, anon;
grant update (name) on public.channels to authenticated;

-- ---------- contacts ----------
create policy "contacts: membros veem" on public.contacts
  for select to authenticated using (public.has_system_access(system_id));
create policy "contacts: membros criam" on public.contacts
  for insert to authenticated with check (public.has_system_access(system_id));
create policy "contacts: membros editam" on public.contacts
  for update to authenticated
  using (public.has_system_access(system_id))
  with check (public.has_system_access(system_id));
create policy "contacts: admin exclui" on public.contacts
  for delete to authenticated using (public.has_system_access(system_id, 'admin'));

-- ---------- conversations ----------
create policy "conversations: membros veem" on public.conversations
  for select to authenticated using (public.has_system_access(system_id));
create policy "conversations: membros atualizam" on public.conversations
  for update to authenticated
  using (public.has_system_access(system_id))
  with check (public.has_system_access(system_id));

-- ---------- messages ----------
create policy "messages: membros veem" on public.messages
  for select to authenticated using (public.has_system_access(system_id));
-- Pelo painel só entram notas internas; mensagens ao cliente saem pela API.
create policy "messages: notas internas" on public.messages
  for insert to authenticated
  with check (
    public.has_system_access(system_id)
    and is_internal = true
    and sender_type = 'agent'
    and sender_id = (select auth.uid())
    and direction = 'out'
  );

-- ---------- quick_replies ----------
create policy "quick_replies: membros veem" on public.quick_replies
  for select to authenticated using (public.has_system_access(system_id));
create policy "quick_replies: supervisor cria" on public.quick_replies
  for insert to authenticated with check (public.has_system_access(system_id, 'supervisor'));
create policy "quick_replies: supervisor edita" on public.quick_replies
  for update to authenticated
  using (public.has_system_access(system_id, 'supervisor'))
  with check (public.has_system_access(system_id, 'supervisor'));
create policy "quick_replies: supervisor exclui" on public.quick_replies
  for delete to authenticated using (public.has_system_access(system_id, 'supervisor'));

-- ---------- consent_events (somente inserção; histórico imutável) ----------
create policy "consent: membros veem" on public.consent_events
  for select to authenticated using (public.has_system_access(system_id));
create policy "consent: membros registram" on public.consent_events
  for insert to authenticated
  with check (public.has_system_access(system_id) and actor_id = (select auth.uid()) and source = 'agent');

-- ---------- cookie_consents ----------
create policy "cookies: registrar o próprio" on public.cookie_consents
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy "cookies: ver o próprio" on public.cookie_consents
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- data_requests ----------
create policy "data_requests: supervisor vê" on public.data_requests
  for select to authenticated using (public.has_system_access(system_id, 'supervisor'));
create policy "data_requests: supervisor cria" on public.data_requests
  for insert to authenticated
  with check (public.has_system_access(system_id, 'supervisor') and created_by = (select auth.uid()));
create policy "data_requests: supervisor atualiza" on public.data_requests
  for update to authenticated
  using (public.has_system_access(system_id, 'supervisor'))
  with check (public.has_system_access(system_id, 'supervisor'));

-- ---------- audit_logs (leitura para admins; escrita via log_audit) ----------
create policy "audit: admins veem" on public.audit_logs
  for select to authenticated
  using (
    public.is_platform_admin()
    or (system_id is not null and public.has_system_access(system_id, 'admin'))
  );

-- ---------- Funções: quem pode chamar ----------
revoke execute on function public.next_protocol(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_system() from public, anon, authenticated;
revoke execute on function public.log_audit(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.log_audit(uuid, text, text, text, jsonb) to authenticated;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.has_system_access(uuid, public.system_role) from anon;
revoke execute on function public.shares_system_with(uuid) from anon;

-- ---------- Realtime (caixa de entrada ao vivo) ----------
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.channels;
