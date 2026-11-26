# Deploy na VPS (Hostinger)

A VPS já roda os projetos `bookweb` e `evolution`. O WebAgent sobe como um **terceiro projeto**, sem tocar nos outros. A única alteração compartilhada é **acrescentar um bloco** no Caddyfile e recarregar o Caddy (recarga sem reinício: o Bookweb não cai).

## 1. Pré-requisitos

1. Domínio `webcashcompany.tech` registrado, com registros **A** de `@` e `www` apontando para `187.53.103.70`.
2. Imagens publicadas no GHCR pelo workflow `.github/workflows/images.yml` (roda a cada push na `main`).
3. Chave secreta do Supabase (Settings → API Keys → `sb_secret_...`).

## 2. Terminal da VPS (hPanel → VPS → Terminal do navegador)

Baixe o compose:

```bash
mkdir -p /opt/webagent && cd /opt/webagent && curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/Barreto0620/WebAgent/main/infra/docker-compose.yml
```

Crie o `.env` com segredos gerados na própria VPS:

```bash
cd /opt/webagent && printf '%s\n' "SUPABASE_URL=https://rgbwengbshwtxjlctpip.supabase.co" "SUPABASE_SERVICE_ROLE_KEY=COLE_AQUI" "EVOLUTION_API_KEY=$(openssl rand -hex 32)" "EVOLUTION_DB_PASSWORD=$(openssl rand -hex 24)" "WEBHOOK_SECRET=$(openssl rand -hex 32)" "HEARTBEAT_INTERVAL_HOURS=24" "SEND_MIN_INTERVAL_MS=1200" "WEBAGENT_TAG=latest" > .env && chmod 600 .env
```

Abra o arquivo e troque `COLE_AQUI` pela chave secreta do Supabase:

```bash
nano /opt/webagent/.env
```

Se as imagens no GHCR forem privadas, faça login uma vez (token do GitHub com permissão `read:packages`):

```bash
docker login ghcr.io -u Barreto0620
```

Suba o projeto:

```bash
cd /opt/webagent && docker compose pull && docker compose up -d && docker compose ps
```

## 3. Publicar no domínio (Caddy existente)

Backup do Caddyfile:

```bash
cp /opt/evolution/Caddyfile /opt/evolution/Caddyfile.bak-$(date +%F)
```

Acrescente o bloco do WebAgent no final:

```bash
curl -fsSL https://raw.githubusercontent.com/Barreto0620/WebAgent/main/infra/caddy/webagent.caddy >> /opt/evolution/Caddyfile
```

Valide antes de aplicar:

```bash
docker exec evolution_caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Só se a validação disser `Valid configuration`, aplique:

```bash
docker exec evolution_caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Se a validação falhar, restaure o backup e não rode o `reload`:

```bash
cp /opt/evolution/Caddyfile.bak-$(date +%F) /opt/evolution/Caddyfile
```

O certificado HTTPS é emitido sozinho pelo Caddy quando o DNS já aponta para a VPS.

## 4. Primeiro acesso

1. Supabase → Authentication → Users → **Add user** (marque *Auto Confirm User*). O **primeiro usuário vira administrador da plataforma**.
2. Supabase → Authentication → Sign In / Providers → desligue **Allow new users to sign up** (só administradores criam contas).
3. Supabase → Authentication → URL Configuration → Site URL `https://webcashcompany.tech` e Redirect URL `https://webcashcompany.tech/auth/callback`.
4. Entre no painel → **Canais** → crie o canal e conecte o número por QR Code ou código de pareamento.

## Atualizar

```bash
cd /opt/webagent && docker compose pull && docker compose up -d
```

## Verificar

```bash
cd /opt/webagent && docker compose ps
```

```bash
docker exec webagent_api wget -qO- http://127.0.0.1:3001/health/deep
```

```bash
docker logs --tail 50 webagent_api
```

## Reverter

Parar o WebAgent (os dados ficam nos volumes):

```bash
cd /opt/webagent && docker compose down
```

Remover o bloco do Caddy restaurando o backup:

```bash
cp /opt/evolution/Caddyfile.bak-AAAA-MM-DD /opt/evolution/Caddyfile && docker exec evolution_caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```
