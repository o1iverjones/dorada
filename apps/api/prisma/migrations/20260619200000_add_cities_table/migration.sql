CREATE TABLE "cities" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organization_id" TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cities_organization_id_name_key" UNIQUE ("organization_id", "name"),
  CONSTRAINT "cities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed from existing interpreter preferred_cities arrays
INSERT INTO "cities" ("organization_id", "name")
SELECT DISTINCT i.organization_id, city
FROM "interpreters" i
CROSS JOIN LATERAL unnest(i.preferred_cities) AS city
WHERE city IS NOT NULL AND city <> ''
ON CONFLICT DO NOTHING;
