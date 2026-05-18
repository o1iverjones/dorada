FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN pnpm install --frozen-lockfile --filter @dorada/api...

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @dorada/types build
RUN pnpm --filter @dorada/utils build
RUN pnpm --filter @dorada/api exec prisma generate
RUN pnpm --filter @dorada/api build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production

# Preserve the full pnpm workspace layout so all symlinks resolve correctly.
# pnpm puts package-level symlinks in apps/api/node_modules/ — without this,
# @prisma/client and other deps are unreachable from /app/apps/api/dist/.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/apps/api/prisma /app/apps/api/prisma
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json

# Workspace packages imported at runtime
COPY --from=builder /app/packages/types/package.json /app/packages/types/package.json
COPY --from=builder /app/packages/types/dist /app/packages/types/dist
COPY --from=builder /app/packages/utils/package.json /app/packages/utils/package.json
COPY --from=builder /app/packages/utils/dist /app/packages/utils/dist

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
