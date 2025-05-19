-- CreateTable
CREATE TABLE "WorkerAvailability" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerScheduleOverride" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "WorkerScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerAvailability_workerId_idx" ON "WorkerAvailability"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAvailability_workerId_dayOfWeek_key" ON "WorkerAvailability"("workerId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "WorkerScheduleOverride_workerId_date_idx" ON "WorkerScheduleOverride"("workerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerScheduleOverride_workerId_date_key" ON "WorkerScheduleOverride"("workerId", "date");

-- AddForeignKey
ALTER TABLE "WorkerAvailability" ADD CONSTRAINT "WorkerAvailability_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerScheduleOverride" ADD CONSTRAINT "WorkerScheduleOverride_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
