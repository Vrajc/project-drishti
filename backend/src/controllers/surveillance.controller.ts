import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import * as surveillance from '../services/surveillance.service.js';
import { ValidationError } from '../services/surveillance.service.js';
import { runHealthSweep, getLastSweepSummary, config as healthConfig } from '../services/cameraHealth.service.js';

// Follows the envelope the rest of the API already uses: { success, data } or
// { success: false, message }.

function fail(res: Response, error: any, fallback: string) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  // A unique-constraint breach that slipped past the pre-check (two writers
  // racing) should still read as a conflict, not a server fault.
  if (error?.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A camera with that id already exists',
    });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Camera not found' });
  }

  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const getCameras = async (req: Request, res: Response) => {
  try {
    const result = await surveillance.listCameras({
      q: req.query.q as string | undefined,
      status: req.query.status as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      siteId: req.query.siteId as string | undefined,
      eventId: req.query.eventId as string | undefined,
      located: parseBoolean(req.query.located),
      skip: parseInteger(req.query.skip),
      take: parseInteger(req.query.take),
    });

    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch cameras');
  }
};

export const getCamera = async (req: Request, res: Response) => {
  try {
    const camera = await surveillance.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    res.status(200).json({ success: true, data: camera });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch camera');
  }
};

export const createCamera = async (req: Request, res: Response) => {
  try {
    const camera = await surveillance.createCamera(req.body);
    res.status(201).json({ success: true, message: 'Camera registered', data: camera });
  } catch (error: any) {
    fail(res, error, 'Failed to register camera');
  }
};

export const updateCamera = async (req: Request, res: Response) => {
  try {
    const camera = await surveillance.updateCamera(req.params.id, req.body);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    res.status(200).json({ success: true, message: 'Camera updated', data: camera });
  } catch (error: any) {
    fail(res, error, 'Failed to update camera');
  }
};

export const deleteCamera = async (req: Request, res: Response) => {
  try {
    const deleted = await surveillance.deleteCamera(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    res.status(200).json({ success: true, message: 'Camera removed from the registry' });
  } catch (error: any) {
    fail(res, error, 'Failed to delete camera');
  }
};

export const getDepartments = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ success: true, data: await surveillance.listDepartments() });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch departments');
  }
};

export const getSites = async (req: Request, res: Response) => {
  try {
    const sites = await surveillance.listSites(req.query.departmentId as string | undefined);
    res.status(200).json({ success: true, data: sites });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch sites');
  }
};

export const getStats = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ success: true, data: await surveillance.getRegistryStats() });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch registry statistics');
  }
};

// ---------------------------------------------------------------------------
// Stream playback and health
// ---------------------------------------------------------------------------

export const getCameraStreamEndpoints = async (req: Request, res: Response) => {
  try {
    const stream = await surveillance.getCameraStream(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }
    res.status(200).json({ success: true, data: stream });
  } catch (error: any) {
    fail(res, error, 'Failed to resolve stream URLs');
  }
};

/**
 * Probes every camera now rather than waiting for the next tick. The response
 * carries the real sweep summary, including which cameras changed state and
 * why, so an operator can see the effect of pulling a stream immediately.
 */
export const runHealthCheck = async (_req: Request, res: Response) => {
  try {
    const summary = await runHealthSweep();
    res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    fail(res, error, 'Health sweep failed');
  }
};

export const runCameraHealthCheck = async (req: Request, res: Response) => {
  try {
    const camera = await surveillance.getCameraById(req.params.id);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }

    const summary = await runHealthSweep([req.params.id]);
    const updated = await surveillance.getCameraById(req.params.id);

    res.status(200).json({ success: true, data: { camera: updated, sweep: summary } });
  } catch (error: any) {
    fail(res, error, 'Health check failed');
  }
};

export const getHealthStatus = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        enabled: healthConfig.enabled,
        intervalSeconds: Math.round(healthConfig.intervalMs / 1000),
        timeoutMs: healthConfig.timeoutMs,
        concurrency: healthConfig.concurrency,
        retentionHours: healthConfig.retentionHours,
        // Null until this process has completed a sweep. It is not a claim that
        // no sweep has ever run - a restart clears it.
        lastSweep: getLastSweepSummary(),
      },
    });
  } catch (error: any) {
    fail(res, error, 'Failed to read health poller status');
  }
};

/**
 * Estate-wide crowd picture. Empty while no detector is running, and the client
 * is told how many zones exist versus how many have ever reported, so an empty
 * list reads as "not measured yet" rather than "nobody is there".
 */
export const getCrowd = async (_req: Request, res: Response) => {
  try {
    const data = await surveillance.getEstateCrowd();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    fail(res, error, 'Failed to read estate crowd data');
  }
};

/**
 * Attach a registry camera to an event, or detach it.
 *
 * Organizers reach this for their own events; admin and police for any. The
 * service enforces which, because the route middleware cannot see whose event
 * is being targeted.
 */
export const setCameraAssignment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const raw = req.body?.eventId;
    const eventId = raw === null || raw === undefined || raw === '' ? null : String(raw);

    const camera = await surveillance.setCameraAssignment(req.params.id, eventId, req.user);
    if (!camera) {
      return res.status(404).json({ success: false, message: 'Camera not found' });
    }

    res.status(200).json({
      success: true,
      message: eventId ? 'Camera assigned to the event' : 'Camera released back to the registry',
      data: camera,
    });
  } catch (error: any) {
    if (error?.name === 'ForbiddenError') {
      return res.status(403).json({ success: false, message: error.message });
    }
    fail(res, error, 'Failed to change the camera assignment');
  }
};
