import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/tracking`;

export interface SightingCamera {
  id: string;
  cameraId: string;
  name: string;
  location: string;
  /** Null when the camera has never been surveyed, so it cannot be mapped. */
  latitude: number | null;
  longitude: number | null;
}

export interface Sighting {
  detectionId: string;
  ts: string;
  camera: SightingCamera;
  plateNumber: string | null;
  plateConfidence: number | null;
  objectClass: string;
  vehicleType: string | null;
  color: string | null;
  confidence: number;
  bbox: number[];
  snapshotPath: string | null;
  trackId: number | null;
}

export type LinkCertainty = 'CERTAIN' | 'PROBABLE';

export interface TrailLink {
  fromDetectionId: string;
  toDetectionId: string;
  certainty: LinkCertainty;
  /** Null on a CERTAIN link: the plates matched, nothing was inferred. */
  score: number | null;
  reasoning: {
    plateMatch: boolean;
    colorMatch: boolean | null;
    typeMatch: boolean | null;
    straightLineMetres: number | null;
    secondsApart: number;
    impliedKmh: number | null;
    note: string;
  };
}

export interface Trail {
  query: { plate: string | null; normalised: string | null };
  sightings: Sighting[];
  links: TrailLink[];
  /** Cameras in the trail with no survey, listed rather than silently dropped. */
  unmappableCameras: string[];
  samplingNote: string;
  trailNote: string;
}

export interface DetectionSearch {
  detections: Sighting[];
  total: number;
  skip: number;
  take: number;
  samplingNote: string;
}

export interface SearchFacets {
  objectClasses: string[];
  colors: string[];
  cameras: Array<{ id: string; cameraId: string; name: string }>;
}

function authHeaders() {
  const token = localStorage.getItem('drishti_token');
  if (!token) throw new Error('Authentication token not found. Sign in again.');
  return { Authorization: `Bearer ${token}` };
}

function rethrow(error: any, action: string): never {
  throw new Error(error?.response?.data?.message || error?.message || `${action} failed`);
}

export const getTrail = async (plate: string, params: { from?: string; to?: string } = {}) => {
  try {
    const response = await axios.get<{ success: boolean; data: Trail }>(
      `${API_URL}/plate/${encodeURIComponent(plate)}`,
      { params, headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Building the trail');
  }
};

export const searchDetections = async (params: {
  cameraId?: string;
  objectClass?: string;
  plate?: string;
  color?: string;
  from?: string;
  to?: string;
  skip?: number;
  take?: number;
} = {}) => {
  try {
    const response = await axios.get<{ success: boolean } & DetectionSearch>(
      `${API_URL}/detections`,
      { params, headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    rethrow(error, 'Searching detections');
  }
};

export const getFacets = async () => {
  try {
    const response = await axios.get<{ success: boolean; data: SearchFacets }>(
      `${API_URL}/facets`,
      { headers: authHeaders() }
    );
    return response.data.data;
  } catch (error: any) {
    rethrow(error, 'Loading search filters');
  }
};

/** CSV of exactly what is on screen. Values are quoted; nulls become empty. */
export function detectionsToCsv(detections: Sighting[]): string {
  const header = [
    'timestamp', 'cameraId', 'cameraName', 'location', 'class', 'vehicleType',
    'plateNumber', 'plateConfidence', 'color', 'confidence', 'trackId', 'snapshotPath',
  ];

  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = detections.map((detection) =>
    [
      detection.ts,
      detection.camera.cameraId,
      detection.camera.name,
      detection.camera.location,
      detection.objectClass,
      detection.vehicleType,
      detection.plateNumber,
      detection.plateConfidence,
      detection.color,
      detection.confidence,
      detection.trackId,
      detection.snapshotPath,
    ].map(escape).join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
