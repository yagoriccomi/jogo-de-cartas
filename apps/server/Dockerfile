# Dockerfile de PRODUÇÃO do servidor de jogo. Contexto de build = RAIZ do repositório:
#   docker build -f apps/server/Dockerfile -t fodinha-server .

# ---------- Estágio 1: build (devDependencies + tsup) ----------
FROM node:24-alpine AS build
WORKDIR /app

# Manifests primeiro, para aproveitar o cache de camadas quando só o código muda.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @fodinha/server

# ---------- Estágio 2: dependências de produção (só as do servidor) ----------
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
# @fodinha/shared já vem embutido no bundle (tsup noExternal): o link do workspace é removido.
RUN npm ci --omit=dev -w @fodinha/server --no-audit --no-fund \
 && rm -rf node_modules/@fodinha

# ---------- Estágio 3: runtime ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/dist ./dist
# As migrations são lidas na subida, ao lado de dist/ (dist/../migrations).
COPY --chown=node:node apps/server/migrations ./migrations
COPY --chown=node:node apps/server/package.json ./package.json

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/main.js"]
