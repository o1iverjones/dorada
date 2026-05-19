#!/bin/sh
set -e

echo "[entrypoint] pwd=$(pwd)"
echo "[entrypoint] listing dist/:"
ls -la dist/ 2>&1 || echo "[entrypoint] dist/ not found!"

echo "[entrypoint] running migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server..."
exec node dist/main.js
