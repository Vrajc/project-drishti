import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import prisma from '../lib/prisma';

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

      const zones: Zone[] = event.zones.map((zone: any, index: number) => ({
        id: zone.zoneId || `zone-${index}`,
        name: zone.name || zone,
        coordinates: zone.coordinates || [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        maxCapacity: zone.maxCapacity || 10,
      }));

      const records = await this.processVideo(
        videoPath,
        eventId,
        zones,
        cameraId,
        cameraName,
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
   * Generate and save mock crowd density data
   */
  async generateAndSaveMockCrowdData(
    eventId: string,
    cameraId?: string,
    cameraName?: string
  ) {
    try {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { zones: true },
      });
      if (!event) {
        throw new Error('Event not found');
      }

      let zones: any[] = event.zones && event.zones.length > 0 ? event.zones : [
        { zoneId: 'zone-0', name: 'main stage' },
        { zoneId: 'zone-1', name: 'food court' },
        { zoneId: 'zone-2', name: 'vip area' }
      ];

      zones = zones.map((zone: any, index: number) => {
        if (typeof zone === 'string') {
          return { id: `zone-${index}`, name: zone };
        }
        return {
          id: zone.zoneId || zone.id || `zone-${index}`,
          name: zone.name || zone,
        };
      });

      console.log('🔍 Event zones:', JSON.stringify(zones, null, 2));

      const records: any[] = [];
      const numFrames = 24;

      for (let i = 0; i < numFrames; i++) {
        const videoSeconds = i * 5;
        const videoTimestamp = `0:${String(Math.floor(videoSeconds / 60)).padStart(2, '0')}:${String(videoSeconds % 60).padStart(2, '0')}`;

        zones.forEach((zone: any, zoneIndex: number) => {
          const baseCount = 5 + Math.floor(Math.random() * 5);
          const variation = Math.floor(Math.random() * 3) - 1;
          const peopleCount = Math.max(3, baseCount + variation);
          const maxCapacity = 10;
          const densityPercentage = Math.min(100, (peopleCount / maxCapacity) * 100);

          records.push({
            eventId,
            zoneId: zone.id || `zone-${zoneIndex}`,
            zoneName: zone.name || `Zone ${zoneIndex + 1}`,
            peopleCount,
            densityPercentage,
            timestamp: new Date(Date.now() - (numFrames - i - 1) * 5000),
            videoTimestamp,
            cameraId: cameraId || 'camera-1',
            cameraName: cameraName || 'Main Camera',
            frameNumber: i,
            confidence: 0.85 + Math.random() * 0.1,
            processingTime: 100 + Math.random() * 50,
          });
        });
      }

      const result = await prisma.crowdDensity.createMany({ data: records });

      console.log(`✅ Generated ${result.count} mock crowd density records`);

      return {
        success: true,
        recordCount: result.count,
        message: `Successfully generated ${result.count} mock crowd density records`,
      };
    } catch (error: any) {
      console.error('Error generating mock crowd data:', error);
      return {
        success: false,
        recordCount: 0,
        message: error.message,
      };
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

      // Group by zoneId and hour
      const grouped = new Map<string, {
        zoneId: string;
        hour: number;
        zoneName: string;
        densities: number[];
        peopleCounts: number[];
      }>();

      for (const record of records) {
        const hour = new Date(record.timestamp).getHours();
        const key = `${record.zoneId}-${hour}`;
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
