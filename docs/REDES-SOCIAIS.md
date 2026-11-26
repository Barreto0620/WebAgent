# Conectar Instagram, Facebook e TikTok

O WebAgent publica pelas **APIs oficiais**. Cada rede exige um "app" de desenvolvedor da empresa. As chaves desse app vão no `.env` do projeto `webagent` na VPS. Nunca coloque essas chaves no código nem no chat.

## Instagram e Facebook (Meta)

Pré-requisitos: uma **Página do Facebook** da empresa e uma conta do **Instagram profissional** (Empresa ou Criador) ligada a essa Página.

1. Acesse developers.facebook.com → **Meus apps → Criar app** → tipo **Empresa**.
2. No app, adicione o produto **Login do Facebook para Empresas**.
3. Em **Configurações do login**, cadastre o URI de redirecionamento:
   `https://webagent.bookweb.tech/redes/callback/meta`
4. Em **Configurações → Básico**, copie o **ID do app** e a **Chave secreta do app**.
5. No `.env` da VPS (`/docker/webagent/.env`), preencha `META_APP_ID` e `META_APP_SECRET` e reinicie o projeto.
6. No painel: **Canais → Instagram e Facebook** → faça login e marque a Página e o Instagram.

**Modo de desenvolvimento x revisão da Meta:** com o app em modo de desenvolvimento, a publicação funciona para quem tem função no app (Administrador, Desenvolvedor ou Testador). Para uso interno da WebCash isso basta: adicione as pessoas em **Funções do app**. A revisão da Meta só é necessária se contas de fora da empresa forem conectar.

Permissões pedidas: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.

Limites:
- Instagram: até 10 itens no carrossel, legenda de até 2.200 caracteres e 30 hashtags, e um limite diário de publicações pela API definido pela Meta.
- Vídeo no Instagram sai como **Reels**.

## TikTok

1. Acesse developers.tiktok.com → **Manage apps → Create app**.
2. Adicione **Login Kit** e **Content Posting API** (com **Direct Post** ativado).
3. Cadastre o Redirect URI: `https://webagent.bookweb.tech/redes/callback/tiktok`.
4. Copie **Client key** e **Client secret** para `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` no `.env` e reinicie o projeto.
5. No painel: **Canais → TikTok**.

**Auditoria do TikTok:** enquanto o app não passa pela auditoria, os vídeos são publicados como **privados (só eu)**. Depois de aprovado, saem públicos sozinhos. O TikTok aceita só vídeo.

## Reiniciar depois de mudar o `.env`

```bash
cd /docker/webagent && docker compose up -d
```

## Tamanho dos arquivos

O plano gratuito do Supabase aceita arquivos de até **50 MB**. Para vídeos maiores: comprima antes de enviar, ou passe o Supabase para o plano Pro e aumente o limite em Storage → Settings.
