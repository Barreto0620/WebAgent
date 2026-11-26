-- =====================================================================
-- WebAgent · Storage e dados iniciais
-- =====================================================================

-- ---------- Buckets ----------
-- media: arquivos das conversas (privado; caminho = <system_id>/<conversation_id>/<arquivo>)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','audio/ogg','audio/mpeg','audio/mp4','audio/webm','application/pdf','application/zip','text/plain','text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel']
)
on conflict (id) do nothing;

-- avatars: foto dos usuários do painel (caminho = <user_id>/<arquivo>)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "media: membros leem" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.has_system_access(((storage.foldername(name))[1])::uuid)
  );

create policy "media: membros enviam" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.has_system_access(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: dono exclui" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Sistemas iniciais da WebCash ----------
insert into public.systems (slug, name, description, color, protocol_prefix)
values
  ('bookweb', 'Bookweb', 'Plataforma Bookweb', '#2BD14A', 'BW'),
  ('promoforia', 'Promoforia', 'Plataforma Promoforia', '#E9A23B', 'PF')
on conflict (slug) do nothing;

-- ---------- Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) ----------
-- Carnaval e Corpus Christi são ponto facultativo, mas a maioria das empresas não abre.
insert into public.holidays (system_id, date, name) values
  (null, '2026-11-02', 'Finados'),
  (null, '2026-11-15', 'Proclamação da República'),
  (null, '2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  (null, '2026-12-25', 'Natal'),
  (null, '2027-01-01', 'Confraternização Universal'),
  (null, '2027-02-08', 'Carnaval (ponto facultativo)'),
  (null, '2027-02-09', 'Carnaval (ponto facultativo)'),
  (null, '2027-03-26', 'Sexta-feira Santa'),
  (null, '2027-04-21', 'Tiradentes'),
  (null, '2027-05-01', 'Dia do Trabalho'),
  (null, '2027-05-27', 'Corpus Christi (ponto facultativo)'),
  (null, '2027-09-07', 'Independência do Brasil'),
  (null, '2027-10-12', 'Nossa Senhora Aparecida'),
  (null, '2027-11-02', 'Finados'),
  (null, '2027-11-15', 'Proclamação da República'),
  (null, '2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
  (null, '2027-12-25', 'Natal');
