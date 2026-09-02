-- CreateEnum
CREATE TYPE "WatchlistEntityType" AS ENUM ('VEHICLE', 'PERSON');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('PLATE_EXACT', 'PLATE_FUZZY', 'FACE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'DISPATCHED', 'CLOSED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "watchlist_entries" (
    "id" TEXT NOT NULL,
    "entityType" "WatchlistEntityType" NOT NULL,
    "plateNumber" TEXT,
    "plateNormalised" TEXT,
    "vehicleMakeModel" TEXT,
    "color" TEXT,
    "personName" TEXT,
    "photoUrl" TEXT,
    "embedding" JSONB,
    "caseNumber" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detections" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "trackId" INTEGER,
    "trackGeneration" INTEGER NOT NULL DEFAULT 0,
    "objectClass" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "bbox" JSONB NOT NULL,
    "plateNumber" TEXT,
    "plateNormalised" TEXT,
    "plateConfidence" DOUBLE PRECISION,
    "color" TEXT,
    "vehicleType" TEXT,
    "snapshotPath" TEXT,
    "ts" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "watchlistEntryId" TEXT NOT NULL,
    "detectionId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_points" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "trackId" INTEGER NOT NULL,
    "trackGeneration" INTEGER NOT NULL DEFAULT 0,
    "ts" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "plateNormalised" TEXT,
    "plateNumber" TEXT,
    "objectClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlist_entries_plateNormalised_idx" ON "watchlist_entries"("plateNormalised");

-- CreateIndex
CREATE INDEX "watchlist_entries_isActive_entityType_idx" ON "watchlist_entries"("isActive", "entityType");

-- CreateIndex
CREATE INDEX "watchlist_entries_caseNumber_idx" ON "watchlist_entries"("caseNumber");

-- CreateIndex
CREATE INDEX "detections_cameraId_ts_idx" ON "detections"("cameraId", "ts");

-- CreateIndex
CREATE INDEX "detections_plateNormalised_idx" ON "detections"("plateNormalised");

-- CreateIndex
CREATE INDEX "detections_plateNumber_idx" ON "detections"("plateNumber");

-- CreateIndex
CREATE INDEX "detections_ts_idx" ON "detections"("ts");

-- CreateIndex
CREATE INDEX "detections_objectClass_ts_idx" ON "detections"("objectClass", "ts");

-- CreateIndex
CREATE INDEX "alerts_status_ts_idx" ON "alerts"("status", "ts");

-- CreateIndex
CREATE INDEX "alerts_watchlistEntryId_ts_idx" ON "alerts"("watchlistEntryId", "ts");

-- CreateIndex
CREATE INDEX "alerts_cameraId_ts_idx" ON "alerts"("cameraId", "ts");

-- CreateIndex
CREATE INDEX "alerts_ts_idx" ON "alerts"("ts");

-- CreateIndex
CREATE INDEX "track_points_plateNormalised_ts_idx" ON "track_points"("plateNormalised", "ts");

-- CreateIndex
CREATE INDEX "track_points_cameraId_ts_idx" ON "track_points"("cameraId", "ts");

-- CreateIndex
CREATE INDEX "track_points_trackId_cameraId_ts_idx" ON "track_points"("trackId", "cameraId", "ts");

-- CreateIndex
CREATE INDEX "track_points_ts_idx" ON "track_points"("ts");

-- AddForeignKey
ALTER TABLE "watchlist_entries" ADD CONSTRAINT "watchlist_entries_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detections" ADD CONSTRAINT "detections_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_watchlistEntryId_fkey" FOREIGN KEY ("watchlistEntryId") REFERENCES "watchlist_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "detections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_points" ADD CONSTRAINT "track_points_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
