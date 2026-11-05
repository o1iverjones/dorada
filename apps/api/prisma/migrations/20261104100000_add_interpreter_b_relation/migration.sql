-- AlterTable: add interpreter_b_id column
ALTER TABLE "appointments" ADD COLUMN "interpreter_b_id" TEXT;

-- Backfill: match existing billing_interpreter names to interpreter IDs within the same org
UPDATE "appointments" a
SET "interpreter_b_id" = i."id"
FROM "interpreters" i
WHERE a."billing_interpreter" IS NOT NULL
  AND a."billing_interpreter" != ''
  AND i."name" = a."billing_interpreter"
  AND i."organization_id" = a."organization_id";

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_interpreter_b_id_fkey" FOREIGN KEY ("interpreter_b_id") REFERENCES "interpreters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "appointments_interpreter_b_id_idx" ON "appointments"("interpreter_b_id");
