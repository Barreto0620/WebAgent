-- =====================================================================
-- WebAgent · Move as funções auxiliares para o schema "private"
-- (não exposto pela API REST do Supabase). As policies continuam
-- apontando para elas, porque o Postgres referencia funções pelo OID.
-- =====================================================================
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.role_rank(public.system_role) set schema private;
alter function public.is_platform_admin() set schema private;
alter function public.has_system_access(uuid, public.system_role) set schema private;
alter function public.shares_system_with(uuid) set schema private;
alter function public.next_protocol(uuid) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.handle_new_system() set schema private;
alter function public.set_updated_at() set schema private;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.has_system_access(p_system uuid, p_min public.system_role default 'agent')
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
      or exists (
        select 1 from public.system_members m
        where m.system_id = p_system
          and m.user_id = (select auth.uid())
          and private.role_rank(m.role) >= private.role_rank(p_min)
      );
$$;

create or replace function public.log_audit(p_system uuid, p_action text, p_entity text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado';
  end if;
  if p_system is not null and not private.has_system_access(p_system) then
    raise exception 'Sem acesso ao sistema';
  end if;
  insert into public.audit_logs (system_id, actor_id, action, entity, entity_id, metadata)
  values (p_system, (select auth.uid()), left(p_action, 80), left(p_entity, 80), left(p_entity_id, 120), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.role_rank(public.system_role) to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.has_system_access(uuid, public.system_role) to authenticated, service_role;
grant execute on function private.shares_system_with(uuid) to authenticated, service_role;
grant execute on function private.next_protocol(uuid) to service_role;

-- RPC para o servidor gerar protocolo (somente service_role)
create or replace function public.next_protocol(p_system uuid)
returns text language sql security definer set search_path = '' as $$
  select private.next_protocol(p_system);
$$;
revoke all on function public.next_protocol(uuid) from public, anon, authenticated;
grant execute on function public.next_protocol(uuid) to service_role;

revoke all on function public.log_audit(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.log_audit(uuid, text, text, text, jsonb) to authenticated;
