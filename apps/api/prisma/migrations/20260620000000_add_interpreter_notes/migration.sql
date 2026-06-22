CREATE TABLE "interpreter_notes" (
  "id" TEXT NOT NULL,
  "interpreter_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "content" VARCHAR(800) NOT NULL,
  "image_url" TEXT,
  "admin_id" TEXT,
  "admin_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interpreter_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "interpreter_notes" ADD CONSTRAINT "interpreter_notes_interpreter_id_fkey"
  FOREIGN KEY ("interpreter_id") REFERENCES "interpreters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interpreter_notes" ADD CONSTRAINT "interpreter_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
