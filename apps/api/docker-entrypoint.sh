#!/bin/sh

echo "[entrypoint] running migrations..."
if node_modules/.bin/prisma migrate deploy; then
  echo "[entrypoint] migrations OK"
else
  echo "[entrypoint] WARNING: migrations failed (exit $?) — starting server anyway"
fi

echo "[entrypoint] starting server..."
exec node dist/main.js 2>&1
