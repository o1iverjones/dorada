#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
node_modules/.bin/prisma migrate resolve --rolled-back 20261015000000_add_web_push_subscription 2>/dev/null || true
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server..."
exec node dist/main.js 2>&1
