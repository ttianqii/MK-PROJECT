# syntax=docker/dockerfile:1

# ── Builder ───────────────────────────────────────────────────────────────
# Node base (the Next.js build and the runtime run on Node) with the Bun
# binary dropped in, so dependencies install from the committed bun.lock.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

# Install deps against the committed lockfile for reproducible builds.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the standalone server (traces node_modules, incl. mysql2).
COPY . .
RUN bun run build

# ── Runner ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone server + assets. `public` and `.next/static` are not copied into
# standalone automatically, so add them explicitly.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migration + seed runners, executed by the entrypoint before the server
# boots. Next bundles drizzle-orm into the server chunks, so it is absent from
# the traced standalone node_modules — copy it back for migrate.mjs (mysql2 is
# already traced in because it is a serverExternalPackage).
COPY --from=builder /app/scripts/migrate.mjs ./migrate.mjs
COPY --from=builder /app/scripts/seed.mjs ./seed.mjs
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
