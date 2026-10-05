# syntax=docker/dockerfile:1
FROM oven/bun:1.4.2 AS bun

FROM node:24.20.0-bookworm-slim AS base
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile && npm rebuild better-sqlite3 \
    && node -e "const DB=require('better-sqlite3');new DB(':memory:').close()"
COPY . .
# Build-only placeholders: the actual secrets are injected at runtime.
RUN DATABASE_URL=file:/tmp/mykipcity-build/database.sqlite bun run db:generate
# Enable WAL once before Next.js starts its parallel page-data workers.
RUN node -e "const DB=require('better-sqlite3');const db=new DB('/tmp/mykipcity-build/database.sqlite');db.pragma('journal_mode = WAL');db.close()"
RUN NODE_ENV=production DEMO_MODE=true \
    DATABASE_URL=file:/tmp/mykipcity-build/database.sqlite \
    DOCUMENTS_DIR=/tmp/mykipcity-build/documents \
    BETTER_AUTH_URL=https://build.kipcity.invalid \
    BETTER_AUTH_SECRET=build-only-placeholder-never-used-at-runtime \
    NEXT_TELEMETRY_DISABLED=1 bun run build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/app/data/mykipcity.db DOCUMENTS_DIR=/app/data/documents
# Keep Prisma CLI and tsx for migrations, seeds and maintenance commands.
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data/documents && chown -R node:node /app/data \
    && chmod +x /app/deploy/docker-entrypoint.sh
USER node
EXPOSE 3200
ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3200"]
