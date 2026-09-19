# Multi-stage build for the HanFlix frontend.
#
# Stage 1 — builder: install deps with pnpm and run `vite build`, which
#           emits hashed bundles into /app/dist.
# Stage 2 — runtime: copy the static dist + nginx.conf into the official
#           nginx:alpine image. Nginx serves the SPA on port 80 with
#           try_files fallback for React Router deep links.

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Enable pnpm via corepack (ships with Node 22)
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build-time env can be wired here; defaults to dev API URL.
# Vite reads VITE_* prefixed vars at build time. The frontend calls
# `${VITE_API_BASE_URL}/notifications` etc., and Nginx reverse-proxies
# /api/* to the backend container which mounts routes under API_PREFIX.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN pnpm run build

# ──────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace the default site config with our SPA-aware one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the Vite build output. Nginx serves /usr/share/nginx/html by default.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
