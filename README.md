# WebAgent

Central de atendimento e mensageria da **WebCash Company**. Conecta um número de WhatsApp por sistema (Bookweb, Promoforia…), responde sozinho (boas-vindas, fora do horário, descadastro LGPD), gera protocolo para cada conversa e organiza a fila de suporte. Instagram, Facebook e TikTok entram nas próximas etapas.

## Arquitetura

```
Navegador ──HTTPS──▶ Caddy (já existente na VPS) ──▶ webagent_web (Next.js)
                                                        │  token do usuário
                                                        ▼
                     Supabase (Auth, Postgres+RLS,  ◀── webagent_api (Fastify + BullMQ)
                     Storage, Realtime)                 │        ▲ webhook
                                                        ▼        │
                                        webagent_redis   webagent_evolution ──▶ WhatsApp
                                                         (+ Postgres próprio)
```

- **Isolado do sistema atual:** projeto Docker próprio (`webagent`), rede própria, Evolution e Redis próprios, sem portas abertas. Só o painel entra na rede do Caddy.
- **Permissões no banco (RLS):** cada usuário só vê os sistemas dos quais é membro. Funções auxiliares ficam no schema `private`, fora da API pública.
- **Fila de envio:** uma mensagem por vez, com intervalo mínimo (`SEND_MIN_INTERVAL_MS`), para proteger o número contra bloqueio.
- **Ping do banco:** o worker grava em `system_heartbeats` a cada `HEARTBEAT_INTERVAL_HOURS` (padrão 24 h) e ao iniciar, para o Supabase gratuito não pausar.

## Estrutura

| Pasta | O que tem |
|---|---|
| `apps/web` | Painel Next.js 16 (App Router, Tailwind 4) |
| `apps/api` | API + worker: webhook da Evolution, automações, envio, heartbeat |
| `packages/shared` | Regras compartilhadas (horário, telefone, templates) e tipos do banco |
| `supabase/migrations` | Schema, RLS, storage e dados iniciais |
| `infra` | `docker-compose.yml`, bloco do Caddy, `.env.example` |

## Desenvolvimento

```bash
corepack enable && pnpm install
cp .env.example .env            # preencha as chaves
pnpm --filter @webagent/api dev # API em :3001
pnpm --filter @webagent/web dev # painel em :3000
pnpm -r typecheck && pnpm --filter @webagent/shared test && pnpm --filter @webagent/api test
```

## Deploy

Veja [docs/DEPLOY.md](docs/DEPLOY.md).

## Módulos

| Módulo | O que faz |
|---|---|
| Atendimento | Caixa de entrada em tempo real, fila, assumir, transferir, notas internas, respostas rápidas, resolver com pesquisa de satisfação |
| Automação | Boas-vindas, fora do horário, feriados, encerramento, CSAT, descadastro por SAIR/VOLTAR |
| Contatos | Cadastro, etiquetas, consentimento com evidência, iniciar conversa |
| Campanhas | Só opt-in, intervalo aleatório, janela de horário, limite diário, pausa automática |
| Publicações | Instagram, Facebook e TikTok via APIs oficiais, calendário e agendamento ([guia](docs/REDES-SOCIAIS.md)) |
| Relatórios | 1ª resposta, resolução, CSAT, por atendente, exportação CSV |
| Equipe | Contas, papéis (atendente, supervisor, administrador) por sistema |
| LGPD | Cookies, pedidos do titular (15 dias), exportação, anonimização, retenção diária, auditoria |
