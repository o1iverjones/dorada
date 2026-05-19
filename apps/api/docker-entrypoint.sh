#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server..."
exec node dist/main.js 2>&1
