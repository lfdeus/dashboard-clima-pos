# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the Angular application
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Cache npm install layer: copy lockfile/manifest first.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source. environment.ts is .gitignored — pass it via a build context
# arg or mount it as a build secret (see README). For simplicity we copy
# the example over if a real environment.ts is missing.
COPY . .
RUN if [ ! -f src/environments/environment.ts ]; then \
      cp src/environments/environment.example.ts src/environments/environment.ts; \
    fi

RUN npm run build:prod

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve static bundle through nginx
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replace the default config with one that handles SPA routing + gzip + cache.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular CLI emits to dist/<project>/browser since v17.
COPY --from=build /app/dist/dashboard-clima/browser /usr/share/nginx/html

EXPOSE 80

# Healthcheck so orchestrators know when the container is ready.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
