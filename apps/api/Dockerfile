# syntax=docker/dockerfile:1.7
# Contexto: raiz do repositório
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter "@webagent/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @webagent/api build \
 && pnpm --filter @webagent/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
