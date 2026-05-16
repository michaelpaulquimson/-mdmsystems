# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
RUN npm pkg delete scripts.prepare && npm ci --workspace=shared --workspace=frontend

COPY tsconfig.base.json ./
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public

WORKDIR /app/frontend
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
