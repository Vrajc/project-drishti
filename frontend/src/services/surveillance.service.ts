import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/surveillance`;

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';

export interface CameraRef {
  id: string;
  code?: string;
  name: string;
}

export interface HealthCheck {
  id: string;
  checkedAt: string;
  status: CameraStatus;
  latencyMs: number | null;
  fpsObserved: number | null;
  error: string | null;
}

export interface RegistryCamera {
  id: string;
  cameraId: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;

  // Null until the camera has been surveyed. Render an empty state, never a
  // substituted coordinate.
  latitude: number | null;
  longitude: number | null;
  coverageAngle: number | null;
  coverageRadius: number | null;
  isPtz: boolean;

  vendor: string | null;
  model: string | null;
  protocol: string | null;
  onvifUrl: string | null;
  username: string | null;
  resolution: string | null;
  fps: number | null;

  // UNKNOWN with lastSeenAt null means no probe has reached this camera yet.
  status: CameraStatus;
  lastSeenAt: string | null;

  departmentId: string | null;
  siteId: string | null;
  eventId: string | null;

  department: CameraRef | null;
  site: CameraRef | null;
  event: { id: string; name: string } | null;

  hasCredentials: boolean;
  healthChecks?: HealthCheck[];

  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  cameraCount: number;
  siteCount: number;
}

export interface Site {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  department: CameraRef | null;
  cameraCount: number;
}

export interface RegistryStats {
  total: number;
  byStatus: Record<CameraStatus, number>;
  located: number;
  unlocated: number;
  ptz: number;
  attachedToEvent: number;
  registryOnly: number;
  byDepartment: Array<{ id: string; code: string; name: string; cameraCount: number }>;
  /** Null until a health check has actually run. */
  lastHealthCheckAt: string | null;
}

export interface CameraQuery {
  q?: string;
  status?: string;
  departmentId?: string;
  siteId?: string;
  eventId?: string;
  located?: boolean;
  skip?: number;
  take?: number;
}

export interface CameraPayload {
  cameraId: string;
  name: string;
  location: string;
  ipAddress?: string;
  rtspUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  coverageAngle?: number | null;
  coverageRadius?: number | null;
  isPtz?: boolean;
  vendor?: string | null;
  model?: string | null;
  protocol?: string | null;
  onvifUrl?: string | null;
  username?: string | null;
  password?: string | null;
  resolution?: string | null;
  fps?: number | null;
  departmentId?: string | null;
  siteId?: string | null;
  eventId?: string | null;
}

function authHeaders() {
  const token = localStorage.getItem('drishti_token');
  if (!token) {
    throw new Error('Authentication token not found. Sign in again to reach the camera registry.');
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Surfaces the server's own message. Swallowing it and showing a generic
 * "something went wrong" would hide exactly the detail an operator needs.
 */
function rethrow(error: any, action: string): never {
  const message = error?.response?.data?.message || error?.message || `${action} failed`;
  const wrapped = new Error(message);
  (wrapped as any).status = error?.response?.status;
  throw wrapped;
}

export const getCameras = async (query: CameraQuery = {}) => {
  try {
    const response = await axios.get<{
      success: boolean;
      cameras: RegistryCamera[];
      total: number;
      skip: number;
      take: number;
    }>(`${API_URL}/cameras`, { params: query, headers: authHeaders() });
    return response.data;
  } catch (error: any) {
    rethrow(error, 'Fetching cameras');
  }
};

export const getCamera = async (id: string) => {
  try {
    const response = await axios.get<{ success: boolean; data: RegistryCamera }>(
      `${API_URL}/cameras/${id}`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Fetching camera');
  }
};

export const createCamera = async (payload: CameraPayload) => {
  try {
    const response = await axios.post<{ success: boolean; data: RegistryCamera }>(
      `${API_URL}/cameras`,
      payload,
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Registering camera');
  }
};

export const updateCamera = async (id: string, payload: Partial<CameraPayload>) => {
  try {
    const response = await axios.put<{ success: boolean; data: RegistryCamera }>(
      `${API_URL}/cameras/${id}`,
      payload,
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Updating camera');
  }
};

export const deleteCamera = async (id: string) => {
  try {
    await axios.delete(`${API_URL}/cameras/${id}`, { headers: authHeaders() });
  } catch (error: any) {
    rethrow(error, 'Deleting camera');
  }
};

export const getDepartments = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: Department[] }>(
      `${API_URL}/departments`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Fetching departments');
  }
};

export const getSites = async (departmentId?: string) => {
  try {
    const response = await axios.get<{ success: boolean; data: Site[] }>(`${API_URL}/sites`, {
      params: departmentId ? { departmentId } : undefined,
      headers: authHeaders(),
    });
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Fetching sites');
  }
};

export const getRegistryStats = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: RegistryStats }>(`${API_URL}/stats`, {
      headers: authHeaders(),
    });
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Fetching registry statistics');
  }
};

// ---------------------------------------------------------------------------
// Stream playback and health probing (Phase 2)
// ---------------------------------------------------------------------------

export interface StreamEndpoints {
  cameraId: string;
  name: string;
  status: CameraStatus;
  lastSeenAt: string | null;
  rtspUrl: string;
  /** False when the server cannot honestly offer a browser-playable URL. */
  playable: boolean;
  hlsUrl: string | null;
  webrtcUrl: string | null;
  /** Why it is not playable. Null when it is. */
  reason: string | null;
}

export interface SweepSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  probed: number;
  skipped: number;
  byStatus: Record<string, number>;
  changed: Array<{ cameraId: string; from: CameraStatus; to: CameraStatus; reason: string | null }>;
  prunedHealthRows: number;
}

export interface HealthPollerStatus {
  enabled: boolean;
  intervalSeconds: number;
  timeoutMs: number;
  concurrency: number;
  retentionHours: number;
  /** Null until this server process has finished a sweep; a restart clears it. */
  lastSweep: SweepSummary | null;
}

export const getCameraStream = async (id: string) => {
  try {
    const response = await axios.get<{ success: boolean; data: StreamEndpoints }>(
      `${API_URL}/cameras/${id}/stream`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Resolving stream URL');
  }
};

export const getHealthStatus = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: HealthPollerStatus }>(
      `${API_URL}/health`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Reading health poller status');
  }
};

export const runHealthCheck = async () => {
  try {
    const response = await axios.post<{ success: boolean; data: SweepSummary }>(
      `${API_URL}/health-check`,
      {},
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Running a health sweep');
  }
};

export const runCameraHealthCheck = async (id: string) => {
  try {
    const response = await axios.post<{
      success: boolean;
      data: { camera: RegistryCamera; sweep: SweepSummary };
    }>(`${API_URL}/cameras/${id}/health-check`, {}, { headers: authHeaders() });
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Probing camera');
  }
};

// ---------------------------------------------------------------------------
// Estate crowd
// ---------------------------------------------------------------------------

export interface EstateZoneReading {
  peopleCount: number;
  densityPercentage: number;
  timestamp: string;
  /** The analyser's own confidence for the frame, or null if it reported none. */
  confidence: number | null;
  /** peopleCount / maxCapacity, or null when no capacity is declared. */
  occupancyRatio: number | null;
}

export interface EstateZone {
  id: string;
  zoneId: string;
  name: string;
  maxCapacity: number;
  camera: {
    id: string;
    cameraId: string;
    name: string;
    location: string;
    status: CameraStatus;
    latitude: number | null;
    longitude: number | null;
    site: CameraRef | null;
  } | null;
  /** Null means no count has ever been recorded — not an occupancy of zero. */
  latest: EstateZoneReading | null;
}

export interface EstateCrowd {
  zones: EstateZone[];
  zonesDefined: number;
  zonesReporting: number;
  readings: number;
}

export const getEstateCrowd = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: EstateCrowd }>(`${API_URL}/crowd`, {
      headers: authHeaders(),
    });
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Fetching estate crowd data');
  }
};

/**
 * Attaches a registry camera to an event, or releases it back to the registry.
 *
 * The server decides whether the caller may: an organizer only for their own
 * events, admin and police for any. A refusal comes back with its reason.
 */
export const setCameraAssignment = async (cameraId: string, eventId: string | null) => {
  try {
    const response = await axios.put<{ success: boolean; data: RegistryCamera }>(
      `${API_URL}/cameras/${cameraId}/assignment`,
      { eventId },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Changing the camera assignment');
  }
};
