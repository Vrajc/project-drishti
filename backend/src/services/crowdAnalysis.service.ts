import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

interface Zone {
  id: string;
  name: string;
  coordinates: Array<{ x: number; y: number }>;
  maxCapacity: number;
}

interface CrowdDensityRecord {
  eventId: string;
  zoneId: string;
  zoneName: string;
  peopleCount: number;
  densityPercentage: number;
  timestamp: string;
  videoTimestamp: string;
  cameraId?: string;
  cameraName?: string;
  metadata?: {
    frameNumber?: number;
    confidence?: number;
    processingTime?: number;
  };
}

export class CrowdAnalysisService {
  private pythonScript: string;

  constructor() {
    this.pythonScript = path.join(__dirname, '..', 'services', 'crowd_analyzer.py');
  }

  /**
   * Process video file and extract crowd density data
   */
  async processVideo(
    videoPath: string,
    eventId: string,
    zones: Zone[],
    cameraId?: string,
    cameraName?: string,
    sampleInterval: number = 15
  ): Promise<CrowdDensityRecord[]> {
    try {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      if (!zones || zones.length === 0) {
        throw new Error('At least one zone must be defined');
      }

      const tempZonesFile = path.join(__dirname, `zones-${Date.now()}.json`);
      fs.writeFileSync(tempZonesFile, JSON.stringify(zones));

      try {
        console.log(`Processing video for event ${eventId}...`);
        const command = `python "${this.pythonScript}" "${videoPath}" "${tempZonesFile}" "${eventId}" ${sampleInterval}`;

        const { stdout, stderr } = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr) {
          console.warn('Python script warnings:', stderr);
        }

        const results: CrowdDensityRecord[] = JSON.parse(stdout);

        if (cameraId && cameraName) {
          results.forEach(record => {
            record.cameraId = cameraId;
            record.cameraName = cameraName;
          });
        }

        return results;
      } finally {
        if (fs.existsSync(tempZonesFile)) {
          fs.unlinkSync(tempZonesFile);
        }
      }
    } catch (error: any) {
      console.error('Error processing video:', error);
      throw new Error(`Failed to process video: ${error.message}`);
    }
  }

  /**
   * Process video and save results to database
   */
  async processAndSaveVideo(
    videoPath: string,
    eventId: string,
    cameraId?: string,
    cameraName?: string,
    sampleInterval: number = 15
  ): Promise<{ success: boolean; recordCount: number; message: string }> {
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { zones: true },
      });
      if (!event) {
        throw new Error('Event not found');
      }

      if (!event.zones || event.zones.length === 0) {
        throw new Error('Event has no zones defined');
      }

      // `id` MUST be the Zone row's UUID, not its human-facing `zoneId`. CrowdDensity.zoneId
      // is a foreign key to zones.id (crowd_densities_zoneId_fkey); passing "zone-0" here is
      // what made every write fail with P2003. The analyzer echoes this id straight back.
      const zones: Zone[] = event.zones.map((zone: any) => ({
        id: zone.id,
        name: zone.name,
        coordinates: (zone.coordinates as Array<{ x: number; y: number }>) || [],
        maxCapacity: zone.maxCapacity,
      }));

      // A zone with no polygon cannot contain anyone: point-in-polygon returns false for
      // every detection, so the analyzer would report a confident zero. Say so instead of
      // silently substituting a full-frame rectangle.
      const zonesWithoutGeometry = zones.filter(z => !z.coordinates || z.coordinates.length < 3);
      if (zonesWithoutGeometry.length > 0) {
        throw new Error(
          `Cannot analyse footage: ${zonesWithoutGeometry.length} of ${zones.length} zone(s) ` +
            `have no boundary defined (${zonesWithoutGeometry.map(z => z.name).join(', ')}). ` +
            `Draw each zone's area on the venue map before running analysis.`
        );
      }

      // CrowdDensity.cameraId is a foreign key to cameras.id. Accept either the UUID or the
      // event-scoped cameraId from the caller, resolve it to the real row, and store null
      // rather than an invented literal when the footage is not attributed to a camera.
      let resolvedCameraId: string | undefined;
      let resolvedCameraName: string | undefined;

      if (cameraId) {
        const camera = await prisma.camera.findFirst({
          where: { eventId, OR: [{ id: cameraId }, { cameraId }] },
          select: { id: true, name: true },
        });

        if (!camera) {
          throw new Error(`Camera "${cameraId}" is not registered on this event`);
        }

        resolvedCameraId = camera.id;
        resolvedCameraName = cameraName || camera.name;
      }

      const records = await this.processVideo(
        videoPath,
        eventId,
        zones,
        resolvedCameraId,
        resolvedCameraName,
        sampleInterval
      );

      // Save to database using Prisma createMany
      const result = await prisma.crowdDensity.createMany({
        data: records.map(r => ({
          eventId: r.eventId,
          zoneId: r.zoneId,
          zoneName: r.zoneName,
          peopleCount: r.peopleCount,
          densityPercentage: r.densityPercentage,
          timestamp: new Date(r.timestamp),
          videoTimestamp: r.videoTimestamp,
          cameraId: r.cameraId,
          cameraName: r.cameraName,
          frameNumber: r.metadata?.frameNumber,
          confidence: r.metadata?.confidence,
          processingTime: r.metadata?.processingTime,
        })),
      });

      return {
        success: true,
        recordCount: result.count,
        message: `Successfully processed video and saved ${result.count} records`,
      };
    } catch (error: any) {
      console.error('Error in processAndSaveVideo:', error);
      return {
        success: false,
        recordCount: 0,
        message: error.message,
      };
    }
  }

  /**
   * Get crowd density data for an event
   */
  async getCrowdDensityData(
    eventId: string,
    zoneId?: string,
    startTime?: Date,
    endTime?: Date
  ) {
    try {
      const where: any = { eventId };

      if (zoneId) {
        where.zoneId = zoneId;
      }

      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) where.timestamp.gte = startTime;
        if (endTime) where.timestamp.lte = endTime;
      }

      const data = await prisma.crowdDensity.findMany({
        where,
        orderBy: { timestamp: 'asc' },
      });
      return data;
    } catch (error: any) {
      console.error('Error fetching crowd density data:', error);
      throw new Error(`Failed to fetch crowd density data: ${error.message}`);
    }
  }

  /**
   * Get latest crowd density for each zone
   */
  async getLatestDensityByZone(eventId: string) {
    try {
      // Get distinct zone IDs for this event
      const zones = await prisma.crowdDensity.findMany({
        where: { eventId },
        distinct: ['zoneId'],
        select: { zoneId: true },
      });

      // Get the latest record for each zone
      const latestRecords = await Promise.all(
        zones.map(async ({ zoneId }) => {
          return prisma.crowdDensity.findFirst({
            where: { eventId, zoneId },
            orderBy: { timestamp: 'desc' },
          });
        })
      );

      return latestRecords.filter(Boolean);
    } catch (error: any) {
      console.error('Error fetching latest density:', error);
      throw new Error(`Failed to fetch latest density: ${error.message}`);
    }
  }

  /**
   * Get crowd density statistics for a zone
   */
  async getZoneStatistics(
    eventId: string,
    zoneId: string,
    startTime?: Date,
    endTime?: Date
  ) {
    try {
      const where: any = { eventId, zoneId };

      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) where.timestamp.gte = startTime;
        if (endTime) where.timestamp.lte = endTime;
      }

      const stats = await prisma.crowdDensity.aggregate({
        where,
        _avg: { peopleCount: true, densityPercentage: true },
        _max: { peopleCount: true, densityPercentage: true },
        _min: { peopleCount: true, densityPercentage: true },
        _count: true,
      });

      if (stats._count === 0) return null;

      // Get zone name from the first record
      const firstRecord = await prisma.crowdDensity.findFirst({
        where: { eventId, zoneId },
        select: { zoneName: true },
      });

      return {
        _id: zoneId,
        zoneName: firstRecord?.zoneName || zoneId,
        avgPeopleCount: stats._avg.peopleCount,
        maxPeopleCount: stats._max.peopleCount,
        minPeopleCount: stats._min.peopleCount,
        avgDensity: stats._avg.densityPercentage,
        maxDensity: stats._max.densityPercentage,
        minDensity: stats._min.densityPercentage,
        dataPoints: stats._count,
      };
    } catch (error: any) {
      console.error('Error fetching zone statistics:', error);
      throw new Error(`Failed to fetch zone statistics: ${error.message}`);
    }
  }

  /**
   * Get crowd density heatmap data
   */
  async getHeatmapData(
    eventId: string,
    startTime?: Date,
    endTime?: Date
  ) {
    try {
      const where: any = { eventId };

      if (startTime || endTime) {
        where.timestamp = {};
        if (startTime) where.timestamp.gte = startTime;
        if (endTime) where.timestamp.lte = endTime;
      }

      // Get all records then group in JS (Prisma doesn't support groupBy with date functions)
      const records = await prisma.crowdDensity.findMany({
        where,
        orderBy: { timestamp: 'asc' },
      });

      // Group by zoneId and hour. `zoneId` is nullable since the police
      // operations migration - a reading taken outside any defined zone still
      // has a zoneName - so the grouping key falls back to the name and the
      // response reports zoneId as null rather than inventing one.
      const grouped = new Map<string, {
        zoneId: string | null;
        hour: number;
        zoneName: string;
        densities: number[];
        peopleCounts: number[];
      }>();

      for (const record of records) {
        const hour = new Date(record.timestamp).getHours();
        const key = `${record.zoneId ?? `name:${record.zoneName}`}-${hour}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            zoneId: record.zoneId,
            hour,
            zoneName: record.zoneName,
            densities: [],
            peopleCounts: [],
          });
        }
        const group = grouped.get(key)!;
        group.densities.push(record.densityPercentage);
        group.peopleCounts.push(record.peopleCount);
      }

      const heatmapData = Array.from(grouped.values()).map(g => ({
        _id: { zoneId: g.zoneId, hour: g.hour },
        zoneName: g.zoneName,
        avgDensity: g.densities.reduce((a, b) => a + b, 0) / g.densities.length,
        avgPeopleCount: g.peopleCounts.reduce((a, b) => a + b, 0) / g.peopleCounts.length,
      }));

      heatmapData.sort((a, b) => a._id.hour - b._id.hour);

      return heatmapData;
    } catch (error: any) {
      console.error('Error fetching heatmap data:', error);
      throw new Error(`Failed to fetch heatmap data: ${error.message}`);
    }
  }
}

export default new CrowdAnalysisService();
