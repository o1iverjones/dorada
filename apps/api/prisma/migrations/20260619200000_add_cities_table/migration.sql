-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_organization_id_name_key" ON "cities"("organization_id", "name");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed existing preferred_cities into the new table
INSERT INTO "cities" ("id", "organization_id", "name")
SELECT gen_random_uuid()::text, organization_id, city
FROM (
    SELECT DISTINCT i.organization_id, unnest(i.preferred_cities) AS city
    FROM "interpreters" i
) sub
WHERE city IS NOT NULL AND city <> ''
ON CONFLICT DO NOTHING;
