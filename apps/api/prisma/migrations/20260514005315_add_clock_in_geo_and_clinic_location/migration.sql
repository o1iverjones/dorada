-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "clock_in_distance_miles" DOUBLE PRECISION,
ADD COLUMN     "clock_in_lat" DOUBLE PRECISION,
ADD COLUMN     "clock_in_lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "location_lat" DOUBLE PRECISION,
ADD COLUMN     "location_lng" DOUBLE PRECISION;
