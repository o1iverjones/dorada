# Dorada — Project Memory for Claude

This file records decisions, conventions, and infrastructure facts that Claude should keep in mind across sessions.

---

## Infrastructure & Services

| Role | Service | Notes |
|---|---|---|
| **Hosting** | Railway | Two environments: `dev` branch → dev env, `main` branch → production |
| **Database** | PostgreSQL 16 (Railway plugin) | Managed by Prisma v5 |
| **Cache / Queue** | Redis 7 (Railway plugin) | BullMQ + Socket.io adapter |
| **File storage** | Google Cloud Storage (GCS) | Dev bucket: `pulpito-media` |
| **Transactional email** | **Resend** | `lib/email.ts` is the central helper — do NOT use SendGrid (removed) |
| **SMS** | Twilio | Interpreter login OTP + follow-up prompts |
| **Push notifications** | Firebase FCM | Interpreter mobile app |
| **AI / extraction** | Anthropic Claude API | Email intake parsing |
| **Domain registrar** | **Porkbun** | Domain: `dorada.app` |
| **DNS management** | **Porkbun** | Nameservers currently managed in Porkbun (may be delegated to Cloudflare in production — see DEPLOYMENT.md §Phase 7) |
| **CDN / proxy** | Cloudflare | Planned for production; not yet active |

---

## Email

- **Provider:** Resend (resend.com)
- **Central helper:** `apps/api/src/lib/email.ts` — all email sending goes through `sendEmail()` here
- **From address:** `noreply@dorada.app`
- **Domain verification:** Done via Porkbun DNS — add Resend's SPF, DKIM, and DMARC `TXT` records in the Porkbun DNS management panel for `dorada.app`
- **SendGrid was removed** — do not re-introduce it

---

## Tech Stack

- **Monorepo tool:** pnpm workspaces (`pnpm-workspace.yaml`)
- **API:** Fastify + Prisma v5 (always use `npx prisma@5` commands)
- **Web:** React 19 + Vite + TailwindCSS + shadcn/ui + React Query v5 + React Router v6
- **Mobile:** Expo (React Native)
- **i18n:** `packages/i18n` — keys in `en.json` and `es.json` must always be kept in sync
- **Types:** `packages/types` — must run `pnpm build --filter @dorada/types` after schema changes

---

## Key Conventions

- Zod schemas use `.nullish()` (not `.optional()`) for fields that can be `null` or `undefined`
- `toTzDateTimeInput()` / `fromTzDateTimeInput()` in `apps/web/src/lib/timezone.ts` for datetime-local input ↔ ISO conversion
- `pagination.total` (not `data.length`) for accurate counts when using `limit` query params
- Vite: font/asset paths in CSS must be relative (`./assets/font.ttf`), not absolute (`/font.ttf`)
- Git: two-branch model — `dev` for active work, `main` for production releases via PR

---

## Branching

| Branch | Environment |
|---|---|
| `dev` | Development (Railway dev services) |
| `main` | Production (Railway prod services) |

Never push directly to `main` — always open a PR from `dev`.
