-- Função interna do Supabase: não precisa ser chamável pela API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
