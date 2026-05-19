#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] seeding database..."
node_modules/.bin/tsx prisma/seed.ts || echo "[entrypoint] seed skipped or already done"

echo "[entrypoint] starting server..."
exec node dist/main.js 2>&1
