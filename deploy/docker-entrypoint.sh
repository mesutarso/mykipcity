#!/bin/sh
set -eu

if [ "${DEMO_MODE:-}" != "true" ]; then
  echo "MyKipCity exige DEMO_MODE=true pour cette version." >&2
  exit 1
fi
auth_secret=${BETTER_AUTH_SECRET:-}
if [ "${#auth_secret}" -lt 32 ]; then
  echo "Configurer BETTER_AUTH_SECRET (32 caractères minimum)." >&2
  exit 1
fi
: "${BETTER_AUTH_URL:?Configurer BETTER_AUTH_URL avec le domaine HTTPS}"

node node_modules/prisma/build/index.js migrate deploy
if [ "${SEED_SHOWCASE:-false}" = "true" ]; then
  node --import tsx scripts/seed-showcase.ts
fi
if [ -n "${SEED_USERS_FILE:-}" ]; then
  node --import tsx scripts/seed-users.ts
fi
exec "$@"
