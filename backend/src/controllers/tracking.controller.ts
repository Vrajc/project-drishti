import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import * as tracking from '../services/vehicleTracking.service.js';

// Cross-camera vehicle tracking and detection search.
//
// Both responses carry a `samplingNote`. The detections table is a sample - one
// row per camera-track per interval, plus every plate-bearing detection - and a
// result count must never be read as "the number of times this was seen".

const SAMPLING_NOTE =
  'Detections are sampled: one row per camera track per interval, plus every detection that ' +
  'carried a plate reading. This is not a complete record of everything the detector saw.';

const TRAIL_NOTE =
  'Positions are the cameras\' own surveyed coordinates, not the vehicle\'s. A trail is the ' +
  'sequence of cameras that saw it, not a GPS track.';

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const when = new Date(String(value));
  return Number.isNaN(when.getTime()) ? undefined : when;
}

function fail(res: Response, error: any, fallback: string) {
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

export const getTrail = async (req: AuthRequest, res: Response) => {
  try {
    const plate = String(req.params.plate || '').trim();
    if (plate === '') {
      return res.status(400).json({ success: false, message: 'A plate is required' });
    }

    const trail = await tracking.getTrailByPlate(plate, {
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
      limit: Number(req.query.limit) || undefined,
    });

    if (trail.query.normalised === null) {
      return res.status(400).json({
        success: false,
        message: `"${plate}" contains no letters or digits to search on`,
      });
    }

    res.status(200).json({
      success: true,
      data: { ...trail, samplingNote: SAMPLING_NOTE, trailNote: TRAIL_NOTE },
    });
  } catch (error: any) {
    fail(res, error, 'Failed to build the trail');
  }
};

export const searchDetections = async (req: AuthRequest, res: Response) => {
  try {
    const result = await tracking.searchDetections({
      cameraId: req.query.cameraId ? String(req.query.cameraId) : undefined,
      objectClass: req.query.objectClass ? String(req.query.objectClass) : undefined,
      plate: req.query.plate ? String(req.query.plate) : undefined,
      color: req.query.color ? String(req.query.color) : undefined,
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
      skip: Number(req.query.skip) || undefined,
      take: Number(req.query.take) || undefined,
    });

    res.status(200).json({ success: true, ...result, samplingNote: SAMPLING_NOTE });
  } catch (error: any) {
    fail(res, error, 'Detection search failed');
  }
};

export const getFacets = async (_req: AuthRequest, res: Response) => {
  try {
    // Only values that actually occur, so a filter never offers a colour no
    // camera has ever recorded.
    res.status(200).json({ success: true, data: await tracking.getSearchFacets() });
  } catch (error: any) {
    fail(res, error, 'Failed to read search filters');
  }
};
