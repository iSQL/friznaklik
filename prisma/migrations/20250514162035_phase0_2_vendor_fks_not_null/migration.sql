/*
  Warnings:

  - Made the column `vendorId` on table `Appointment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `vendorId` on table `Service` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_vendorId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "vendorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "vendorId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
