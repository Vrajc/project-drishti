import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CrowdDensity } from '../models/crowdDensity.model';
import { Event } from '../models/event.model';

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
      // Validate video file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      // Validate zones
      if (!zones || zones.length === 0) {
        throw new Error('At least one zone must be defined');
      }

      // Write zones to temporary file to avoid command line escaping issues on Windows
      const tempZonesFile = path.join(__dirname, `zones-${Date.now()}.json`);
      fs.writeFileSync(tempZonesFile, JSON.stringify(zones));

      try {
        // Execute Python script
        console.log(`Processing video for event ${eventId}...`);
        const command = `python "${this.pythonScript}" "${videoPath}" "${tempZonesFile}" "${eventId}" ${sampleInterval}`;
        
        const { stdout, stderr } = await execAsync(command, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        if (stderr) {
          console.warn('Python script warnings:', stderr);
        }

        // Parse results
        const results: CrowdDensityRecord[] = JSON.parse(stdout);

        // Add camera info if provided
        if (cameraId && cameraName) {
          results.forEach(record => {
            record.cameraId = cameraId;
            record.cameraName = cameraName;
          });
        }

        return results;
      } finally {
        // Clean up temporary file
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
      // Get event and zones
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      if (!event.zones || event.zones.length === 0) {
        throw new Error('Event has no zones defined');
      }

      // Convert zones to required format
      // Note: This assumes zones are stored with proper structure in event
      // You may need to adjust based on actual event.zones structure
      const zones: Zone[] = event.zones.map((zone: any, index: number) => ({
        id: zone.id || `zone-${index}`,
        name: zone.name || zone,
        coordinates: zone.coordinates || [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 }
        ],
        maxCapacity: zone.maxCapacity || 10  // Lower default for better visualization
      }));

      // Process video
      const records = await this.processVideo(
        videoPath,
        eventId,
        zones,
        cameraId,
        cameraName,
        sampleInterval
      );

      // Save to database
      const savedRecords = await CrowdDensity.insertMany(records);

      return {
        success: true,
        recordCount: savedRecords.length,
        message: `Successfully processed video and saved ${savedRecords.length} records`
      };
    } catch (error: any) {
      console.error('Error in processAndSaveVideo:', error);
      return {
        success: false,
        recordCount: 0,
        message: error.message
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
      const query: any = { eventId };

      if (zoneId) {
        query.zoneId = zoneId;
      }

      if (startTime || endTime) {
        query.timestamp = {};
        if (startTime) query.timestamp.$gte = startTime;
        if (endTime) query.timestamp.$lte = endTime;
      }

      const data = await CrowdDensity.find(query).sort({ timestamp: 1 });
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
      const data = await CrowdDensity.aggregate([
        { $match: { eventId } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$zoneId',
            latestRecord: { $first: '$$ROOT' }
          }
        },
        {
          $replaceRoot: { newRoot: '$latestRecord' }
        }
      ]);

      return data;
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
      const matchQuery: any = { eventId, zoneId };

      if (startTime || endTime) {
        matchQuery.timestamp = {};
        if (startTime) matchQuery.timestamp.$gte = startTime;
        if (endTime) matchQuery.timestamp.$lte = endTime;
      }

      const stats = await CrowdDensity.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$zoneId',
            zoneName: { $first: '$zoneName' },
            avgPeopleCount: { $avg: '$peopleCount' },
            maxPeopleCount: { $max: '$peopleCount' },
            minPeopleCount: { $min: '$peopleCount' },
            avgDensity: { $avg: '$densityPercentage' },
            maxDensity: { $max: '$densityPercentage' },
            minDensity: { $min: '$densityPercentage' },
            dataPoints: { $sum: 1 }
          }
        }
      ]);

      return stats[0] || null;
    } catch (error: any) {
      console.error('Error fetching zone statistics:', error);
      throw new Error(`Failed to fetch zone statistics: ${error.message}`);
    }
  }

  /**
   * Generate and save mock crowd density data (faster alternative to video processing)
   */
  async generateAndSaveMockCrowdData(
    eventId: string,
    cameraId?: string,
    cameraName?: string
  ) {
    try {
      // Get event to retrieve zones
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Ensure zones have proper structure
      let zones = event.zones && event.zones.length > 0 ? event.zones : [
        { id: 'zone-0', name: 'main stage' },
        { id: 'zone-1', name: 'food court' },
        { id: 'zone-2', name: 'vip area' }
      ];

      // Convert zones to proper format if they're just strings
      zones = zones.map((zone: any, index: number) => {
        if (typeof zone === 'string') {
          return { id: `zone-${index}`, name: zone };
        }
        return {
          id: zone.id || `zone-${index}`,
          name: zone.name || zone
        };
      });

      console.log('🔍 Event zones:', JSON.stringify(zones, null, 2));

      // Generate mock data for multiple timestamps (simulating video frames)
      const records: CrowdDensityRecord[] = [];
      const numFrames = 24; // Simulate 2 minutes of data (24 frames at 5 sec intervals)
      
      for (let i = 0; i < numFrames; i++) {
        const videoSeconds = i * 5;
        const videoTimestamp = `0:${String(Math.floor(videoSeconds / 60)).padStart(2, '0')}:${String(videoSeconds % 60).padStart(2, '0')}`;
        
        zones.forEach((zone: any, zoneIndex: number) => {
          // Generate realistic varying people counts - higher range for better percentages
          const baseCount = 5 + Math.floor(Math.random() * 5); // 5-10 people base
          const variation = Math.floor(Math.random() * 3) - 1; // -1 to +2 variation
          const peopleCount = Math.max(3, baseCount + variation); // Minimum 3 people
          
          // Calculate density with maxCapacity of 10 (gives percentages in 30-100 range)
          const maxCapacity = 10;
          const densityPercentage = Math.min(100, (peopleCount / maxCapacity) * 100);
          
          const record = {
            eventId,
            zoneId: zone.id || `zone-${zoneIndex}`,
            zoneName: zone.name || `Zone ${zoneIndex + 1}`,
            peopleCount,
            densityPercentage,
            timestamp: new Date(Date.now() - (numFrames - i - 1) * 5000),
            videoTimestamp,
            cameraId: cameraId || 'camera-1',
            cameraName: cameraName || 'Main Camera',
            metadata: {
              frameNumber: i,
              confidence: 0.85 + Math.random() * 0.1,
              processingTime: 100 + Math.random() * 50
            }
          };
          
          records.push(record);
        });
      }

      // Save to database
      const savedRecords = await CrowdDensity.insertMany(records);

      console.log(`✅ Generated ${savedRecords.length} mock crowd density records`);

      return {
        success: true,
        recordCount: savedRecords.length,
        message: `Successfully generated ${savedRecords.length} mock crowd density records`
      };
    } catch (error: any) {
      console.error('Error generating mock crowd data:', error);
      return {
        success: false,
        recordCount: 0,
        message: error.message
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
      const matchQuery: any = { eventId };

      if (startTime || endTime) {
        matchQuery.timestamp = {};
        if (startTime) matchQuery.timestamp.$gte = startTime;
        if (endTime) matchQuery.timestamp.$lte = endTime;
      }

      const heatmapData = await CrowdDensity.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              zoneId: '$zoneId',
              hour: { $hour: '$timestamp' }
            },
            zoneName: { $first: '$zoneName' },
            avgDensity: { $avg: '$densityPercentage' },
            avgPeopleCount: { $avg: '$peopleCount' }
          }
        },
        { $sort: { '_id.hour': 1 } }
      ]);

      return heatmapData;
    } catch (error: any) {
      console.error('Error fetching heatmap data:', error);
      throw new Error(`Failed to fetch heatmap data: ${error.message}`);
    }
  }
}

export default new CrowdAnalysisService();
