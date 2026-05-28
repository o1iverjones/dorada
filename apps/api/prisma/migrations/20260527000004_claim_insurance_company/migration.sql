-- AlterTable: add insurance_company_id to claims
ALTER TABLE "claims" ADD COLUMN "insurance_company_id" TEXT;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
