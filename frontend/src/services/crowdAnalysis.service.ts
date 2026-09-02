import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface CrowdDensityData {
  _id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ZoneStatistics {
  _id: string;
  zoneName: string;
  avgPeopleCount: number;
  maxPeopleCount: number;
  minPeopleCount: number;
  avgDensity: number;
  maxDensity: number;
  minDensity: number;
  dataPoints: number;
}

export interface HeatmapDataPoint {
  _id: {
    zoneId: string;
    hour: number;
  };
  zoneName: string;
  avgDensity: number;
  avgPeopleCount: number;
}

export interface Zone {
  id: string;
  name: string;
  coordinates: Array<{ x: number; y: number }>;
  maxCapacity: number;
  color?: string;
}

class CrowdAnalysisService {
  // uploadVideo() was here. There is no upload endpoint to call any more:
  // crowd density is counted live from the cameras an event is assigned, not
  // extracted from footage somebody uploads afterwards.

  /**
   * Get crowd density data for an event
   */
  async getCrowdDensity(
    eventId: string,
    zoneId?: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<CrowdDensityData[]> {
    const token = localStorage.getItem('drishti_token');
    const params: any = {};
    
    if (zoneId) params.zoneId = zoneId;
    if (startTime) params.startTime = startTime.toISOString();
    if (endTime) params.endTime = endTime.toISOString();

    const response = await axios.get(
      `${API_URL}/crowd-analysis/${eventId}/density`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

  /**
   * Get latest crowd density for each zone
   */
  async getLatestDensity(eventId: string): Promise<CrowdDensityData[]> {
    const token = localStorage.getItem('drishti_token');
    const response = await axios.get(
      `${API_URL}/crowd-analysis/${eventId}/latest`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

  /**
   * Get statistics for a specific zone
   */
  async getZoneStatistics(
    eventId: string,
    zoneId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<ZoneStatistics> {
    const token = localStorage.getItem('drishti_token');
    const params: any = {};
    
    if (startTime) params.startTime = startTime.toISOString();
    if (endTime) params.endTime = endTime.toISOString();

    const response = await axios.get(
      `${API_URL}/crowd-analysis/${eventId}/zones/${zoneId}/statistics`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

  /**
   * Get heatmap data for visualization
   */
  async getHeatmapData(
    eventId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<HeatmapDataPoint[]> {
    const token = localStorage.getItem('drishti_token');
    const params: any = {};
    
    if (startTime) params.startTime = startTime.toISOString();
    if (endTime) params.endTime = endTime.toISOString();

    const response = await axios.get(
      `${API_URL}/crowd-analysis/${eventId}/heatmap`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

  /**
   * Get all zones for an event
   */
  async getEventZones(eventId: string): Promise<{ zones: Zone[]; eventName: string }> {
    const token = localStorage.getItem('drishti_token');
    const response = await axios.get(
      `${API_URL}/crowd-analysis/${eventId}/zones`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data.data;
  }

}

export default new CrowdAnalysisService();
