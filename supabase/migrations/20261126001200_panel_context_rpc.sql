-- Contexto do painel numa única chamada (perfil, sistemas, papéis e status do sistema ativo).
-- security invoker: as policies de RLS continuam valendo. Reduz a navegação a 1 ida e volta ao banco.
create or replace function public.panel_context(p_active uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile jsonb;
  v_systems jsonb;
  v_members jsonb;
  v_active uuid;
  v_tz text;
  v_status jsonb := null;
begin
  if v_uid is null then
    return null;
  end if;

  select to_jsonb(p) into v_profile
  from (select id, full_name, avatar_url, theme, is_platform_admin from public.profiles where id = v_uid) p;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]'::jsonb) into v_systems
  from (select id, slug, name, color, protocol_prefix, timezone, description, is_active from public.systems) s;

  select coalesce(jsonb_agg(jsonb_build_object('system_id', system_id, 'role', role)), '[]'::jsonb) into v_members
  from public.system_members where user_id = v_uid;

  select s.id, s.timezone into v_active, v_tz
  from public.systems s
  order by (s.id = p_active) desc, s.is_active desc, s.name
  limit 1;

  if v_active is not null then
    v_status := jsonb_build_object(
      'channels', (select coalesce(jsonb_agg(c.status), '[]'::jsonb) from public.channels c where c.system_id = v_active),
      'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday', h.weekday, 'enabled', h.enabled, 'opens_at', to_char(h.opens_at, 'HH24:MI'), 'closes_at', to_char(h.closes_at, 'HH24:MI'), 'break_start', to_char(h.break_start, 'HH24:MI'), 'break_end', to_char(h.break_end, 'HH24:MI'))), '[]'::jsonb) from public.business_hours h where h.system_id = v_active),
      'holidays', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d.date, 'YYYY-MM-DD'), 'name', d.name)), '[]'::jsonb) from public.holidays d where (d.system_id is null or d.system_id = v_active) and d.date between (now() at time zone v_tz)::date - 1 and (now() at time zone v_tz)::date + 1),
      'queued', (select count(*) from public.conversations q where q.system_id = v_active and q.status in ('queued', 'bot'))
    );
  end if;

  return jsonb_build_object('profile', v_profile, 'systems', v_systems, 'members', v_members, 'active_id', v_active, 'status', v_status);
end;
$$;

revoke all on function public.panel_context(uuid) from public, anon;
grant execute on function public.panel_context(uuid) to authenticated;
