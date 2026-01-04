import { CrowdDensity } from '../models/crowdDensity.model';

/**
 * Generate mock crowd density data for testing
 */
export async function generateMockCrowdData(eventId: string, zones: any[]) {
  const records = [];
  const now = new Date();
  
  // Generate data for last 5 minutes (every 15 seconds)
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (20 - i) * 15000);
    const videoSeconds = i * 15;
    const hours = Math.floor(videoSeconds / 3600);
    const minutes = Math.floor((videoSeconds % 3600) / 60);
    const seconds = videoSeconds % 60;
    const videoTimestamp = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    for (const zone of zones) {
      const baseCount = Math.floor(Math.random() * 50) + 20;
      const variation = Math.sin(i / 5) * 15;
      const peopleCount = Math.max(0, Math.floor(baseCount + variation));
      const maxCapacity = zone.maxCapacity || 100;
      const densityPercentage = Math.min(100, (peopleCount / maxCapacity) * 100);
      
      records.push({
        eventId,
        zoneId: zone.id || `zone-${zones.indexOf(zone)}`,
        zoneName: zone.name || zone,
        peopleCount,
        densityPercentage,
        timestamp,
        videoTimestamp,
        cameraId: 'camera-1',
        cameraName: 'Main Camera',
        metadata: {
          frameNumber: i * 450,
          confidence: 0.85,
          processingTime: 0
        }
      });
    }
  }
  
  // Save to database
  await CrowdDensity.insertMany(records);
  
  console.log(`✅ Generated ${records.length} mock crowd density records`);
  return records;
}
