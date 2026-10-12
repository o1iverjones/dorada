FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/i18n/package.json ./packages/i18n/
COPY apps/pwa/package.json ./apps/pwa/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/pwa/node_modules ./apps/pwa/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/pwa/ ./apps/pwa/
RUN pnpm --filter @dorada/types build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @dorada/pwa build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/pwa/dist /usr/share/nginx/html
COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
