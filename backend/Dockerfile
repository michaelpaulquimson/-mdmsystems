FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm pkg delete scripts.prepare && npm ci --workspace=shared --workspace=backend

COPY tsconfig.base.json ./
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

WORKDIR /app/backend
RUN npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm pkg delete scripts.prepare && npm ci --workspace=shared --workspace=backend --omit=dev

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY backend/src/core/db/migrations ./backend/src/core/db/migrations

WORKDIR /app/backend

ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
