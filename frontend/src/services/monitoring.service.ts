import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/monitoring`;

// Live monitoring reads. Every field below is a row or a count; where nothing
// has been recorded the API returns null or an empty list, and the pages render
// that as an explicit empty state.

export interface ZoneReading {
  peopleCount: number;
  densityPercentage: number;
  observedAt: string;
  cameraName: string | null;
  /** Mean confidence of the person detections behind this count. */
  confidence: number | null;
}

export interface MonitoredZone {
  id: string;
  zoneId: string;
  name: string;
  maxCapacity: number;
  /** Null when nothing has ever been measured in this zone. */
  latestReading: ZoneReading | null;
}

export interface MonitoredCamera {
  id: string;
  cameraId: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';
  lastSeenAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LiveMonitoring {
  event: { id: string; name: string; location: string; crowdSize: number };
  zones: MonitoredZone[];
  cameras: MonitoredCamera[];
  cameraStatusCounts: Record<string, number>;
  incidents: {
    open: number;
    investigating: number;
    resolved: number;
    total: number;
    /** Null when no incident has been resolved yet - not zero. */
    meanResponseSeconds: number | null;
    recent: Array<{
      id: string;
      type: string;
      severity: string;
      source: string;
      status: string;
      description: string;
      location: string;
      timestamp: string;
    }>;
  };
}

export interface Anomaly {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  /** The rule that fired, e.g. CAMERA_OFFLINE. Never null for an anomaly. */
  ruleKey: string | null;
  /** The rule's own computed confidence, never a range. */
  detectionConfidence: number | null;
  camera: { id: string; cameraId: string; name: string } | null;
}

function authHeaders() {
  const token = localStorage.getItem('drishti_token');
  if (!token) throw new Error('Authentication token not found. Sign in again.');
  return { Authorization: `Bearer ${token}` };
}

function rethrow(error: any, action: string): never {
  throw new Error(error?.response?.data?.message || error?.message || `${action} failed`);
}

export const getLiveMonitoring = async (eventId: string): Promise<LiveMonitoring> => {
  try {
    const response = await axios.get<{ success: boolean; data: LiveMonitoring }>(
      `${API_URL}/events/${eventId}/live`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Loading live monitoring');
  }
};

export const getAnomalies = async (eventId: string, take = 50): Promise<Anomaly[]> => {
  try {
    const response = await axios.get<{ success: boolean; data: Anomaly[] }>(
      `${API_URL}/events/${eventId}/anomalies`,
      { params: { take }, headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Loading anomalies');
  }
};
