-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'POLICE';

-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "coverageAngle" DOUBLE PRECISION,
ADD COLUMN     "coverageRadius" DOUBLE PRECISION,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "fps" INTEGER,
ADD COLUMN     "isPtz" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "onvifUrl" TEXT,
ADD COLUMN     "passwordEnc" TEXT,
ADD COLUMN     "protocol" TEXT,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "status" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "username" TEXT,
ADD COLUMN     "vendor" TEXT,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_health" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CameraStatus" NOT NULL,
    "latencyMs" INTEGER,
    "fpsObserved" DOUBLE PRECISION,
    "error" TEXT,

    CONSTRAINT "camera_health_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE INDEX "sites_departmentId_idx" ON "sites"("departmentId");

-- CreateIndex
CREATE INDEX "camera_health_cameraId_checkedAt_idx" ON "camera_health"("cameraId", "checkedAt");

-- CreateIndex
CREATE INDEX "camera_health_checkedAt_idx" ON "camera_health"("checkedAt");

-- CreateIndex
CREATE INDEX "cameras_status_idx" ON "cameras"("status");

-- CreateIndex
CREATE INDEX "cameras_departmentId_idx" ON "cameras"("departmentId");

-- CreateIndex
CREATE INDEX "cameras_siteId_idx" ON "cameras"("siteId");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_health" ADD CONSTRAINT "camera_health_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Registry-only cameras have eventId = NULL, and Postgres treats NULLs as
-- distinct, so cameras_eventId_cameraId_key does not constrain them. This
-- partial index makes cameraId unique across the standalone registry while
-- leaving event-attached cameras governed by the composite key above.
CREATE UNIQUE INDEX "cameras_registry_cameraId_key" ON "cameras"("cameraId") WHERE "eventId" IS NULL;
