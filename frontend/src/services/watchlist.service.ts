import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const WATCHLIST_URL = `${BASE}/watchlist`;
const ALERTS_URL = `${BASE}/alerts`;

export type EntityType = 'VEHICLE' | 'PERSON';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MatchType = 'PLATE_EXACT' | 'PLATE_FUZZY' | 'FACE';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'DISPATCHED' | 'CLOSED' | 'FALSE_POSITIVE';

export interface WatchlistEntry {
  id: string;
  entityType: EntityType;
  /** As it was typed. `plateNormalised` is what the matcher compares. */
  plateNumber: string | null;
  plateNormalised: string | null;
  vehicleMakeModel: string | null;
  color: string | null;
  personName: string | null;
  photoUrl: string | null;
  caseNumber: string;
  caseType: string;
  severity: Severity;
  issuedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  notes: string | null;
  issuer: { id: string; name: string; email: string } | null;
  alertCount: number;
}

export interface WatchlistPayload {
  entityType: EntityType;
  plateNumber?: string;
  vehicleMakeModel?: string;
  color?: string;
  personName?: string;
  caseNumber: string;
  caseType: string;
  severity: Severity;
  expiresAt?: string | null;
  isActive?: boolean;
  notes?: string;
}

export interface Alert {
  id: string;
  matchType: MatchType;
  /** Computed by the engine from the edit distance. Never assigned. */
  matchScore: number;
  ts: string;
  status: AlertStatus;
  acknowledgedAt: string | null;
  notes: string | null;
  watchlistEntry: {
    id: string;
    plateNumber: string | null;
    vehicleMakeModel: string | null;
    color: string | null;
    personName: string | null;
    caseNumber: string;
    caseType: string;
    severity: Severity;
    notes: string | null;
  };
  detection: {
    id: string;
    plateNumber: string | null;
    plateConfidence: number | null;
    objectClass: string;
    vehicleType: string | null;
    color: string | null;
    confidence: number;
    bbox: number[];
    snapshotPath: string | null;
    ts: string;
    trackId: number | null;
  };
  camera: {
    id: string;
    cameraId: string;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
  };
  acknowledger: { id: string; name: string } | null;
}

export interface AlertCounts {
  total: number;
  byStatus: Record<AlertStatus, number>;
  unhandled: number;
  watchlistActive: number;
  /**
   * Detections that actually carried a plate. Zero means no plate reader is
   * running, which is why there are no alerts - a very different thing from a
   * quiet night, and the console must say which.
   */
  platesReadable: number;
  engine: {
    running: boolean;
    connected: boolean;
    entriesRead: number;
    detectionsPersisted: number;
    platesSeen: number;
    alertsRaised: number;
    alertsSuppressedAsDuplicate: number;
    lastError: string | null;
  };
}

function authHeaders() {
  const token = localStorage.getItem('drishti_token');
  if (!token) throw new Error('Authentication token not found. Sign in again.');
  return { Authorization: `Bearer ${token}` };
}

function rethrow(error: any, action: string): never {
  throw new Error(error?.response?.data?.message || error?.message || `${action} failed`);
}

export const getWatchlist = async (params: { q?: string; entityType?: string; active?: string } = {}) => {
  try {
    const response = await axios.get<{ success: boolean; data: WatchlistEntry[] }>(WATCHLIST_URL, {
      params,
      headers: authHeaders(),
    });
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Loading the watchlist');
  }
};

export const createWatchlistEntry = async (payload: WatchlistPayload) => {
  try {
    const response = await axios.post<{ success: boolean; data: WatchlistEntry }>(
      WATCHLIST_URL,
      payload,
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Adding the watchlist entry');
  }
};

export const updateWatchlistEntry = async (id: string, payload: Partial<WatchlistPayload>) => {
  try {
    const response = await axios.put<{ success: boolean; data: WatchlistEntry }>(
      `${WATCHLIST_URL}/${id}`,
      payload,
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Updating the watchlist entry');
  }
};

export const deleteWatchlistEntry = async (id: string, force = false) => {
  try {
    await axios.delete(`${WATCHLIST_URL}/${id}`, {
      params: force ? { force: 'true' } : undefined,
      headers: authHeaders(),
    });
  } catch (error: any) {
    rethrow(error, 'Deleting the watchlist entry');
  }
};

export interface ImportResult {
  imported: number;
  rejected: number;
  entries: WatchlistEntry[];
  /** Per-row, so a caller knows exactly which lines failed and why. */
  rejections: Array<{ line: number; reason: string; row: string }>;
}

export const importWatchlistCsv = async (csv: string) => {
  try {
    const response = await axios.post<{ success: boolean; data: ImportResult }>(
      `${WATCHLIST_URL}/import`,
      { csv },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Importing the CSV');
  }
};

export const getAlerts = async (params: { status?: string; take?: number } = {}) => {
  try {
    const response = await axios.get<{ success: boolean; data: Alert[]; total: number }>(ALERTS_URL, {
      params,
      headers: authHeaders(),
    });
    return response.data;
  } catch (error: any) {
    rethrow(error, 'Loading alerts');
  }
};

export const getAlertCounts = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: AlertCounts }>(
      `${ALERTS_URL}/counts`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Loading alert counts');
  }
};

export const setAlertStatus = async (id: string, status: AlertStatus, notes?: string) => {
  try {
    const response = await axios.patch<{ success: boolean; data: Alert }>(
      `${ALERTS_URL}/${id}/status`,
      { status, ...(notes === undefined ? {} : { notes }) },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Updating the alert');
  }
};
