-- CreateEnum
CREATE TYPE "DispatchUnitStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('MANUAL', 'ANOMALY');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED', 'CLEARED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "incidents" DROP CONSTRAINT "incidents_reporter_fkey";

-- AlterTable
ALTER TABLE "crowd_densities" ALTER COLUMN "eventId" DROP NOT NULL,
ALTER COLUMN "zoneId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dispatch_units" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "status" "DispatchUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
ALTER COLUMN "eventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "cameraId" TEXT,
ADD COLUMN     "detectionConfidence" DOUBLE PRECISION,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "ruleKey" TEXT,
ADD COLUMN     "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "source" "IncidentSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "eventId" DROP NOT NULL,
ALTER COLUMN "reporter" DROP NOT NULL;

-- AlterTable
ALTER TABLE "zones" ADD COLUMN     "cameraId" TEXT,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "dispatch_assignments" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "dispatchedBy" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'DISPATCHED',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "etaSeconds" INTEGER,
    "routeDistanceM" DOUBLE PRECISION,
    "straightLineM" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_assignments_incidentId_idx" ON "dispatch_assignments"("incidentId");

-- CreateIndex
CREATE INDEX "dispatch_assignments_unitId_idx" ON "dispatch_assignments"("unitId");

-- CreateIndex
CREATE INDEX "dispatch_assignments_status_idx" ON "dispatch_assignments"("status");

-- CreateIndex
CREATE INDEX "dispatch_assignments_dispatchedAt_idx" ON "dispatch_assignments"("dispatchedAt");

-- CreateIndex
CREATE INDEX "dispatch_units_departmentId_idx" ON "dispatch_units"("departmentId");

-- CreateIndex
CREATE INDEX "dispatch_units_status_idx" ON "dispatch_units"("status");

-- CreateIndex
CREATE INDEX "incidents_cameraId_idx" ON "incidents"("cameraId");

-- CreateIndex
CREATE INDEX "incidents_cameraId_timestamp_idx" ON "incidents"("cameraId", "timestamp");

-- CreateIndex
CREATE INDEX "incidents_status_severity_idx" ON "incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "incidents_source_ruleKey_timestamp_idx" ON "incidents"("source", "ruleKey", "timestamp");

-- CreateIndex
CREATE INDEX "zones_cameraId_idx" ON "zones"("cameraId");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_units" ADD CONSTRAINT "dispatch_units_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_fkey" FOREIGN KEY ("reporter") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "dispatch_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_dispatchedBy_fkey" FOREIGN KEY ("dispatchedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Hand-written additions. Everything above is Prisma's output; everything below
-- closes gaps Prisma's schema language cannot express, following the precedent
-- set by cameras_registry_cameraId_key in add_camera_registry.
-- ============================================================================

-- Postgres treats NULLs as distinct, so `@@unique([eventId, zoneId])` does not
-- constrain camera zones at all: two zones on the same camera could both claim
-- "gate-a". A partial unique index covers the registry half.
CREATE UNIQUE INDEX "zones_camera_zoneId_key"
    ON "zones" ("cameraId", "zoneId")
    WHERE "eventId" IS NULL;

-- Same reasoning for units that belong to a department rather than an event.
CREATE UNIQUE INDEX "dispatch_units_registry_unitId_key"
    ON "dispatch_units" ("unitId")
    WHERE "eventId" IS NULL;

-- A zone counts people inside exactly one thing: an event's layout, or a
-- camera's field of view. Both set would make `zoneName` ambiguous in
-- crowd_densities; neither set would make the zone unreachable.
ALTER TABLE "zones" ADD CONSTRAINT "zones_scope_check"
    CHECK (("eventId" IS NULL) <> ("cameraId" IS NULL));

-- An incident must have a jurisdiction. Without this, a row with both columns
-- null is invisible to the organizer view (filtered by eventId) and to the
-- police view (filtered by cameraId) at the same time.
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_scope_check"
    CHECK ("eventId" IS NOT NULL OR "cameraId" IS NOT NULL);

-- A responder unit is either an event's own or a department's own. An orphan
-- unit would appear in no dispatch list and could never be sent anywhere.
ALTER TABLE "dispatch_units" ADD CONSTRAINT "dispatch_units_scope_check"
    CHECK ("eventId" IS NOT NULL OR "departmentId" IS NOT NULL);

-- A unit cannot hold two live assignments to the same incident. Re-dispatching
-- after CLEARED or CANCELLED is allowed, which is why the index is partial
-- rather than a plain unique on (incidentId, unitId).
CREATE UNIQUE INDEX "dispatch_assignments_active_key"
    ON "dispatch_assignments" ("incidentId", "unitId")
    WHERE "status" IN ('DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED');

-- An ANOMALY incident is raised by the rule engine and has no human reporter; a
-- MANUAL one is somebody's report and must name them. Keeping these honest in
-- the database means a later "reported by" read cannot silently show nobody.
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reporter_source_check"
    CHECK (("source" = 'MANUAL' AND "reporter" IS NOT NULL)
        OR ("source" = 'ANOMALY' AND "reporter" IS NULL));
