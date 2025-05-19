/*
  Warnings:

  - You are about to drop the column `workingHours` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the `Skill` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ServiceSkills` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_WorkerSkills` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[vendorId,userId]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "ChatSession" DROP CONSTRAINT "ChatSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Worker" DROP CONSTRAINT "Worker_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "_ServiceSkills" DROP CONSTRAINT "_ServiceSkills_A_fkey";

-- DropForeignKey
ALTER TABLE "_ServiceSkills" DROP CONSTRAINT "_ServiceSkills_B_fkey";

-- DropForeignKey
ALTER TABLE "_WorkerSkills" DROP CONSTRAINT "_WorkerSkills_A_fkey";

-- DropForeignKey
ALTER TABLE "_WorkerSkills" DROP CONSTRAINT "_WorkerSkills_B_fkey";

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Worker" DROP COLUMN "workingHours";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "_ServiceSkills";

-- DropTable
DROP TABLE "_WorkerSkills";

-- CreateIndex
CREATE UNIQUE INDEX "Worker_vendorId_userId_key" ON "Worker"("vendorId", "userId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
