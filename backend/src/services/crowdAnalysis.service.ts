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
  // The video-upload path used to live here: an organizer uploaded footage, a
  // Python analyser ran over the file and wrote CrowdDensity rows from it. It
  // is gone. Density now comes from cameras the event has been assigned -
  // counted live by the detector, written by the detection consumer - so this
  // service only reads what the pipeline recorded.


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
