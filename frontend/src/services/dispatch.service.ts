import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const DISPATCH_URL = `${BASE}/dispatch`;
const INCIDENT_URL = `${BASE}/incidents`;

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('drishti_token')}`,
  'Content-Type': 'application/json',
});

export type DispatchUnitStatus = 'available' | 'dispatched' | 'busy' | 'offline';
export type DispatchAssignmentStatus =
  | 'dispatched'
  | 'acknowledged'
  | 'arrived'
  | 'cleared'
  | 'cancelled';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface UnitRef {
  id: string;
  code?: string;
  name: string;
}

export interface DispatchUnit {
  id: string;
  _id: string;
  unitId: string;
  name: string;
  type: string;
  contact: string;
  capacity: number;
  location: string;
  /** Null until the unit's base has been surveyed. Never substitute a value. */
  latitude: number | null;
  longitude: number | null;
  status: DispatchUnitStatus;
  isLocated: boolean;
  scope: 'event' | 'registry';
  departmentId: string | null;
  eventId: string | null;
  department: UnitRef | null;
  event: { id: string; name: string } | null;
}

export interface RankedUnit extends DispatchUnit {
  /** Great-circle metres from the incident, or null when either end is unsurveyed. */
  straightLineM: number | null;
  /** Always null until a routing service is wired in. Render "ETA unavailable". */
  etaSeconds: number | null;
}

export interface DispatchAssignment {
  id: string;
  _id: string;
  incidentId: string;
  unitId: string;
  dispatchedBy: string;
  dispatcherName: string | null;
  status: DispatchAssignmentStatus;
  dispatchedAt: string;
  acknowledgedAt: string | null;
  arrivedAt: string | null;
  clearedAt: string | null;
  etaSeconds: number | null;
  routeDistanceM: number | null;
  straightLineM: number | null;
  notes: string | null;
  /** Derived from two real timestamps, or null. Never estimated. */
  acknowledgedInSeconds: number | null;
  arrivedInSeconds: number | null;
  clearedInSeconds: number | null;
  unit: DispatchUnit | null;
  incident: {
    id: string;
    eventId: string | null;
    cameraId: string | null;
    status: string;
    severity: IncidentSeverity | null;
    description: string;
  } | null;
}

export interface EstateIncident {
  id: string;
  _id: string;
  eventId: string | null;
  cameraId: string | null;
  siteId: string | null;
  type: 'medical' | 'security' | 'lost_found' | 'general';
  /** Null when nobody has classified it - the reporting form does not ask. */
  severity: IncidentSeverity | null;
  source: 'manual' | 'anomaly';
  /** The rule that fired, for anomalies. Null for manual reports. */
  ruleKey: string | null;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  status: 'open' | 'investigating' | 'resolved';
  reporter: string | null;
  reporterName: string | null;
  responseTime: number | null;
  resolvedAt: string | null;
  /** The detector's own confidence, or null when no detector was involved. */
  detectionConfidence: number | null;
  scope: 'event' | 'estate';
  eventName: string | null;
  camera: {
    id: string;
    cameraId: string;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    status: string;
  } | null;
  site: UnitRef | null;
  activeAssignments: Array<{
    id: string;
    _id: string;
    status: DispatchAssignmentStatus;
    dispatchedAt: string;
    acknowledgedAt: string | null;
    arrivedAt: string | null;
    unit: { id: string; unitId: string; name: string; type: string };
  }>;
}

export interface AnomalyRuleCoverage {
  key: string;
  active: boolean;
  requires: string;
}

export interface DispatchStats {
  units: Record<string, number>;
  assignments: Record<string, number>;
  /** Null until something has genuinely been acknowledged. Never render 0 for "none". */
  meanAcknowledgeSeconds: number | null;
  meanArrivalSeconds: number | null;
  measuredFrom: { acknowledgements: number; arrivals: number };
  anomalies: {
    camerasProbed: number;
    densityReadings: number;
    zonesWithCapacity: number;
    openAnomalies: number;
    rules: AnomalyRuleCoverage[];
    thresholds: Record<string, number>;
  };
}

export interface EstateIncidentFilters {
  status?: string;
  severity?: string;
  source?: string;
  cameraId?: string;
  siteId?: string;
  scope?: 'estate' | 'event';
  since?: string;
  take?: number;
}

export const dispatchService = {
  /** The jurisdiction-wide incident feed — police and admin only. */
  async getEstateIncidents(
    filters: EstateIncidentFilters = {}
  ): Promise<{ data: EstateIncident[]; total: number }> {
    const response = await axios.get(`${INCIDENT_URL}/estate`, {
      headers: getAuthHeaders(),
      params: filters,
    });
    return { data: response.data.data, total: response.data.total };
  },

  async getUnits(params: {
    scope?: 'registry' | 'event';
    departmentId?: string;
    status?: string;
    eventId?: string;
  } = {}): Promise<DispatchUnit[]> {
    const response = await axios.get(`${DISPATCH_URL}/units`, {
      headers: getAuthHeaders(),
      params,
    });
    return response.data.data;
  },

  /** Units that can serve one incident, nearest surveyed unit first. */
  async getUnitsForIncident(
    incidentId: string
  ): Promise<{ units: RankedUnit[]; rankedByDistance: boolean }> {
    const response = await axios.get(`${DISPATCH_URL}/incidents/${incidentId}/units`, {
      headers: getAuthHeaders(),
    });
    return { units: response.data.units, rankedByDistance: response.data.rankedByDistance };
  },

  async getAssignments(incidentId: string): Promise<DispatchAssignment[]> {
    const response = await axios.get(`${DISPATCH_URL}/incidents/${incidentId}/assignments`, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  async dispatchUnit(
    incidentId: string,
    unitId: string,
    notes?: string
  ): Promise<DispatchAssignment> {
    const response = await axios.post(
      DISPATCH_URL,
      { incidentId, unitId, notes },
      { headers: getAuthHeaders() }
    );
    return response.data.data;
  },

  async advanceAssignment(
    assignmentId: string,
    action: 'acknowledge' | 'arrive' | 'clear' | 'cancel',
    notes?: string
  ): Promise<DispatchAssignment> {
    const response = await axios.put(
      `${DISPATCH_URL}/${assignmentId}`,
      { action, notes },
      { headers: getAuthHeaders() }
    );
    return response.data.data;
  },

  async updateUnitStatus(unitId: string, status: 'available' | 'busy' | 'offline') {
    const response = await axios.put(
      `${DISPATCH_URL}/units/${unitId}/status`,
      { status },
      { headers: getAuthHeaders() }
    );
    return response.data.data as DispatchUnit;
  },

  async getStats(): Promise<DispatchStats> {
    const response = await axios.get(`${DISPATCH_URL}/stats`, { headers: getAuthHeaders() });
    return response.data.data;
  },

  async updateIncidentStatus(
    incidentId: string,
    status: 'open' | 'investigating' | 'resolved'
  ): Promise<EstateIncident> {
    const response = await axios.put(
      `${INCIDENT_URL}/${incidentId}/status`,
      { status },
      { headers: getAuthHeaders() }
    );
    return response.data.data;
  },
};

/** Metres → a short human string. Returns null for null, never "0 m". */
export function formatDistance(metres: number | null): string | null {
  if (metres === null) return null;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Seconds → "1m 20s". Returns null for null so callers must handle "not measured". */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
