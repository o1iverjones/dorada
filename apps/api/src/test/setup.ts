// Vitest setup: provide the minimum env so `config.ts` can load in tests.
// These values are never used to reach real services — unit tests stub
// prisma/redis; anything needing live infra belongs in integration tests.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_SECRET ??= "vitest-secret-vitest-secret-vitest-secret";
