import { Request, Response } from 'express';
import * as surveillance from '../services/surveillance.service.js';
import { ValidationError } from '../services/surveillance.service.js';

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
