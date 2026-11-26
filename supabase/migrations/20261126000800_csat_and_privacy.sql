-- Pesquisa de satisfação (nota 1 a 5 após o encerramento) e índices de relatório/retenção
alter table public.system_settings
  add column csat_enabled boolean not null default true,
  add column csat_message text not null default 'Como você avalia este atendimento? Responda só com um número de 1 (ruim) a 5 (ótimo).';

alter table public.conversations
  add column csat_requested_at timestamptz,
  add column csat_answered_at timestamptz;

create index conversations_csat_idx on public.conversations (contact_id, csat_requested_at desc) where csat_requested_at is not null and csat_score is null;
create index conversations_resolved_idx on public.conversations (system_id, resolved_at) where status = 'resolved';
