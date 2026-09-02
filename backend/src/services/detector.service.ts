import prisma from '../lib/prisma.js';
import { ValidationError, ZONE_REFERENCE_SIZE } from './surveillance.service.js';

// ============================================================================
// Starting and stopping detection on a camera.
//
// The ai-service has always exposed POST /workers/{cameraId}/start, and nothing
// in this codebase has ever called it. So the chain that produces every crowd
// figure in the product - register a camera, draw a counting zone, count people
// inside it - had no fourth link: somebody had to hand-write an HTTP request to
// the detector, quoting Zone UUIDs read out of the database, and remember to
// state the canvas the polygons were drawn on. Miss the last part and the
// detector runs happily and publishes no occupancy at all.
//
// This composes that request from what the registry already knows. The camera's
// stream URL, its zones, and the reference canvas those zones are expressed in
// come from the same rows the rest of the API serves, so the detector is
// counting inside the boundaries an operator actually drew.
//
// When AI_SERVICE_URL is unset the answer is "no detector is configured", not a
// failure and not a pretence that detection started. A deployment without the
// camera stack is a normal state for this product, and it says so.
// ============================================================================

const DETECTOR_TIMEOUT_MS = 15000;

function detectorUrl(): string | null {
  const url = process.env.AI_SERVICE_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

export class DetectorUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DetectorUnavailable';
  }
}

async function call(path: string, init: RequestInit = {}) {
  const base = detectorUrl();
  if (!base) {
    throw new DetectorUnavailable(
      'No detector is configured: set AI_SERVICE_URL to the ai-service this deployment should use'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DETECTOR_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      // The detector's own reason is passed through rather than replaced by a
      // generic failure: "streamUrl is required" and "a worker is already
      // running" are different problems with different fixes.
      throw new ValidationError(
        typeof body?.detail === 'string' ? body.detail : `Detector returned ${response.status}`
      );
    }

    return body;
  } catch (error: any) {
    if (error instanceof ValidationError) throw error;
    if (error?.name === 'AbortError') {
      throw new DetectorUnavailable(`The detector did not answer within ${DETECTOR_TIMEOUT_MS}ms`);
    }
    throw new DetectorUnavailable(`The detector could not be reached: ${error?.message ?? error}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Whether a detector is configured at all, and what it is currently running. */
export async function getDetectorStatus() {
  const base = detectorUrl();
  if (!base) {
    return {
      configured: false,
      reachable: false,
      reason:
        'No detector is configured. Cameras can be registered and zoned, but nothing will be counted until AI_SERVICE_URL points at a running ai-service.',
      workers: [] as any[],
    };
  }

  try {
    const body = await call('/workers');
    return { configured: true, reachable: true, reason: null, workers: body?.workers ?? [] };
  } catch (error: any) {
    return {
      configured: true,
      reachable: false,
      reason: error?.message ?? 'The detector could not be reached',
      workers: [] as any[],
    };
  }
}

/**
 * Starts detection on one camera, with the zones drawn on it.
 *
 * A camera with no zones is still worth running - it produces detections and
 * track points, which is what plate matching and vehicle trails read - so this
 * does not refuse one. It reports how many zones went with the request, and
 * whether occupancy can therefore be counted, instead of leaving the caller to
 * assume crowd figures will appear.
 */
export async function startDetection(cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, cameraId: true, name: true, rtspUrl: true },
  });
  if (!camera) return null;

  if (!camera.rtspUrl?.trim()) {
    throw new ValidationError(
      'This camera has no stream URL, so there is nothing for the detector to read'
    );
  }

  const zones = await prisma.zone.findMany({
    where: { cameraId },
    select: { id: true, name: true, coordinates: true, maxCapacity: true },
  });

  const body = await call(`/workers/${encodeURIComponent(camera.cameraId)}/start`, {
    method: 'POST',
    body: JSON.stringify({
      streamUrl: camera.rtspUrl,
      zones: zones.map((zone) => ({
        // The detector keys occupancy by this id and the consumer looks the row
        // up by it, so it is the Zone UUID - never the human-facing zoneId.
        id: zone.id,
        name: zone.name,
        coordinates: zone.coordinates,
        maxCapacity: zone.maxCapacity,
      })),
      // Stating this is what makes occupancy countable at all: without it the
      // detector refuses to guess a scale and publishes an empty mapping.
      zoneReferenceSize: ZONE_REFERENCE_SIZE,
    }),
  });

  return {
    camera: { id: camera.id, cameraId: camera.cameraId, name: camera.name },
    zonesSent: zones.length,
    countingPossible: zones.length > 0,
    detector: body,
  };
}

export async function stopDetection(cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, cameraId: true, name: true },
  });
  if (!camera) return null;

  const body = await call(`/workers/${encodeURIComponent(camera.cameraId)}/stop`, {
    method: 'POST',
  });

  return { camera, detector: body };
}
