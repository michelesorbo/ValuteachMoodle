# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable

# --- dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders only so module evaluation succeeds during the build; real values are injected at runtime.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-never-used-at-runtime \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build

# --- runtime ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    FILES_DIR=/data/files \
    RUN_MIGRATIONS=1

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data/files && chown -R app:app /data

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/db/migrations ./db/migrations

USER app
# Persistent volume for files, videos and extracted SCORM packages.
VOLUME /data/files
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
