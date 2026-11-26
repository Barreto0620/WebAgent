-- Administradores da plataforma entram como admin nos sistemas já existentes
-- (para aparecerem na equipe, na transferência de conversas e nos nomes das mensagens).
insert into public.system_members (system_id, user_id, role)
select s.id, p.id, 'admin'
from public.systems s
cross join public.profiles p
where p.is_platform_admin
on conflict (system_id, user_id) do nothing;
