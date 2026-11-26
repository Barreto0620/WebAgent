-- =====================================================================
-- Publicações em redes sociais (Instagram, Facebook, TikTok)
-- Tokens ficam em tabela sem policies: só o servidor (service role) lê.
-- =====================================================================
create type public.social_provider as enum ('instagram', 'facebook', 'tiktok');
create type public.post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'canceled');
create type public.post_target_status as enum ('pending', 'publishing', 'published', 'failed');

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  provider public.social_provider not null,
  external_id text not null,
  name text not null,
  username text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  status_detail text,
  token_expires_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (system_id, provider, external_id)
);
create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function private.set_updated_at();

create table public.social_account_secrets (
  account_id uuid primary key references public.social_accounts (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  refresh_expires_at timestamptz,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.systems (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 5000),
  hashtags text[] not null default '{}',
  media jsonb not null default '[]'::jsonb,
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_system_idx on public.posts (system_id, coalesce(scheduled_at, created_at) desc);
create trigger posts_updated_at before update on public.posts
  for each row execute function private.set_updated_at();

create table public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  system_id uuid not null references public.systems (id) on delete cascade,
  account_id uuid not null references public.social_accounts (id) on delete cascade,
  status public.post_target_status not null default 'pending',
  external_id text,
  permalink text,
  error text,
  published_at timestamptz,
  unique (post_id, account_id)
);

alter table public.social_accounts enable row level security;
alter table public.social_account_secrets enable row level security;
alter table public.posts enable row level security;
alter table public.post_targets enable row level security;

create policy "social: membros veem" on public.social_accounts
  for select to authenticated using (private.has_system_access(system_id));
create policy "social: admin remove" on public.social_accounts
  for delete to authenticated using (private.has_system_access(system_id, 'admin'));

create policy "posts: membros veem" on public.posts
  for select to authenticated using (private.has_system_access(system_id));
create policy "posts: supervisor cria" on public.posts
  for insert to authenticated
  with check (private.has_system_access(system_id, 'supervisor') and created_by = (select auth.uid()) and status = 'draft');
create policy "posts: supervisor edita rascunho" on public.posts
  for update to authenticated
  using (private.has_system_access(system_id, 'supervisor') and status = 'draft')
  with check (private.has_system_access(system_id, 'supervisor') and status = 'draft');
create policy "posts: supervisor exclui" on public.posts
  for delete to authenticated
  using (private.has_system_access(system_id, 'supervisor') and status in ('draft', 'canceled', 'failed', 'published', 'partial'));

create policy "targets: membros veem" on public.post_targets
  for select to authenticated using (private.has_system_access(system_id));
create policy "targets: supervisor define (rascunho)" on public.post_targets
  for insert to authenticated
  with check (
    private.has_system_access(system_id, 'supervisor')
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'draft' and p.system_id = post_targets.system_id)
    and exists (select 1 from public.social_accounts a where a.id = account_id and a.system_id = post_targets.system_id)
  );
create policy "targets: supervisor remove (rascunho)" on public.post_targets
  for delete to authenticated
  using (
    private.has_system_access(system_id, 'supervisor')
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'draft')
  );

-- Mídia das publicações: <system_id>/<post_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social', 'social', false, 524288000, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy "social media: membros leem" on storage.objects
  for select to authenticated
  using (bucket_id = 'social' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and private.has_system_access(((storage.foldername(name))[1])::uuid));
create policy "social media: supervisor envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'social' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and private.has_system_access(((storage.foldername(name))[1])::uuid, 'supervisor'));
create policy "social media: supervisor remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'social' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and private.has_system_access(((storage.foldername(name))[1])::uuid, 'supervisor'));

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_targets;
