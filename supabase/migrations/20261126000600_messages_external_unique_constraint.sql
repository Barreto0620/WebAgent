-- O upsert do PostgREST (on_conflict=system_id,external_id) não reconhece índice parcial.
-- Uma constraint única comum resolve; NULLs continuam permitidos várias vezes (NULLs são distintos).
drop index if exists public.messages_external_idx;
alter table public.messages add constraint messages_system_external_key unique (system_id, external_id);
