import { Prisma, CameraStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';
import {
  encryptCredential,
  isCredentialEncryptionConfigured,
} from '../utils/credentialCrypto.js';

// ============================================================================
// The standalone camera registry (Model 1).
//
// Everything this module returns comes straight out of Postgres. Nothing here
// invents a status, a coordinate or a frame rate: a camera that has never been
// probed reports status UNKNOWN with lastSeenAt null, and a camera that has not
// been surveyed reports latitude/longitude null. Callers must render those as
// empty states rather than substituting a plausible value.
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const PROTOCOLS = ['RTSP', 'ONVIF', 'HTTP'] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export interface CameraInput {
  cameraId?: string;
  name?: string;
  location?: string;
  ipAddress?: string;
  rtspUrl?: string;
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

export interface CameraFilters {
  q?: string;
  status?: string;
  departmentId?: string;
  siteId?: string;
  /** 'none' restricts to registry-only cameras; any other value is an event id. */
  eventId?: string;
  /** true = only cameras that have been surveyed, false = only those that have not. */
  located?: boolean;
  skip?: number;
  take?: number;
}

const cameraInclude = {
  department: { select: { id: true, code: true, name: true } },
  site: { select: { id: true, code: true, name: true } },
  event: { select: { id: true, name: true } },
} satisfies Prisma.CameraInclude;

/**
 * Shapes a camera row for the API. `passwordEnc` never leaves the server - the
 * client is told only whether a credential exists.
 */
export function formatCamera(camera: any) {
  const { passwordEnc, ...rest } = camera;
  return {
    ...rest,
    hasCredentials: Boolean(passwordEnc),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function optionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${field} must be a number`);
  }
  return parsed;
}

function inRange(value: number | null | undefined, min: number, max: number, field: string) {
  if (value === null || value === undefined) return;
  if (value < min || value > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}, got ${value}`);
  }
}

/**
 * Latitude and longitude are only ever stored as a pair. A camera with one half
 * of a coordinate cannot be placed on a map, and storing the half we have would
 * put it somewhere on the equator or the prime meridian - a wrong pin is worse
 * than an honest "not surveyed".
 */
function validateCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  inRange(latitude, -90, 90, 'latitude');
  inRange(longitude, -180, 180, 'longitude');

  const latGiven = latitude !== null && latitude !== undefined;
  const lonGiven = longitude !== null && longitude !== undefined;
  if (latGiven !== lonGiven) {
    throw new ValidationError(
      'latitude and longitude must be supplied together, or both left blank'
    );
  }
}

function normaliseProtocol(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const upper = String(value).toUpperCase();
  if (!PROTOCOLS.includes(upper as Protocol)) {
    throw new ValidationError(`protocol must be one of ${PROTOCOLS.join(', ')}, got "${value}"`);
  }
  return upper;
}

async function assertReferencesExist(input: CameraInput) {
  if (input.departmentId) {
    const found = await prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true },
    });
    if (!found) throw new ValidationError(`Department "${input.departmentId}" does not exist`);
  }

  if (input.siteId) {
    const found = await prisma.site.findUnique({
      where: { id: input.siteId },
      select: { id: true },
    });
    if (!found) throw new ValidationError(`Site "${input.siteId}" does not exist`);
  }

  if (input.eventId) {
    const found = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true },
    });
    if (!found) throw new ValidationError(`Event "${input.eventId}" does not exist`);
  }
}

/**
 * Mirrors the cameras_registry_cameraId_key partial index in the application so
 * the caller gets a readable message rather than a raw P2002, and so the rule
 * still holds if the index is ever missing on a given deployment.
 */
async function assertCameraIdFree(cameraId: string, eventId: string | null, excludeId?: string) {
  const clash = await prisma.camera.findFirst({
    where: {
      cameraId,
      eventId: eventId ?? null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (clash) {
    throw new ValidationError(
      eventId
        ? `Camera id "${cameraId}" is already used on this event`
        : `Camera id "${cameraId}" is already in the registry`
    );
  }
}

function buildCredentialFields(input: CameraInput) {
  if (input.password === undefined) return {};

  // An explicit empty password clears the stored credential.
  if (input.password === null || input.password === '') {
    return { passwordEnc: null };
  }

  if (!isCredentialEncryptionConfigured()) {
    throw new ValidationError(
      'CAMERA_CREDENTIAL_KEY is not configured on the server, so a camera password ' +
        'cannot be stored securely. Register the camera without a password, or set the key.'
    );
  }

  return { passwordEnc: encryptCredential(input.password) };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function buildCameraWhere(filters: CameraFilters): Prisma.CameraWhereInput {
  const where: Prisma.CameraWhereInput = {};

  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { cameraId: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { ipAddress: { contains: q, mode: 'insensitive' } },
      { vendor: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (filters.status) {
    const upper = filters.status.toUpperCase();
    if (!(upper in CameraStatus)) {
      throw new ValidationError(
        `status must be one of ${Object.keys(CameraStatus).join(', ')}, got "${filters.status}"`
      );
    }
    where.status = upper as CameraStatus;
  }

  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.siteId) where.siteId = filters.siteId;

  if (filters.eventId === 'none') {
    where.eventId = null;
  } else if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.located === true) where.latitude = { not: null };
  if (filters.located === false) where.latitude = null;

  return where;
}

export async function listCameras(filters: CameraFilters) {
  const where = buildCameraWhere(filters);
  const take = Math.min(Math.max(filters.take ?? 200, 1), 1000);
  const skip = Math.max(filters.skip ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.camera.findMany({
      where,
      include: cameraInclude,
      orderBy: [{ cameraId: 'asc' }],
      skip,
      take,
    }),
    prisma.camera.count({ where }),
  ]);

  return { cameras: rows.map(formatCamera), total, skip, take };
}

export async function getCameraById(id: string) {
  const camera = await prisma.camera.findUnique({
    where: { id },
    include: {
      ...cameraInclude,
      // The last few probes, so an operator can see whether a camera is flapping
      // rather than only its current state.
      healthChecks: { orderBy: { checkedAt: 'desc' }, take: 20 },
    },
  });

  if (!camera) return null;
  return formatCamera(camera);
}

export async function createCamera(input: CameraInput) {
  const required: Array<keyof CameraInput> = ['cameraId', 'name', 'location', 'rtspUrl'];
  for (const field of required) {
    if (!input[field] || String(input[field]).trim() === '') {
      throw new ValidationError(`${field} is required`);
    }
  }

  const latitude = optionalNumber(input.latitude, 'latitude');
  const longitude = optionalNumber(input.longitude, 'longitude');
  const coverageAngle = optionalNumber(input.coverageAngle, 'coverageAngle');
  const coverageRadius = optionalNumber(input.coverageRadius, 'coverageRadius');
  const fps = optionalNumber(input.fps, 'fps');

  validateCoordinatePair(latitude, longitude);
  inRange(coverageAngle, 0, 360, 'coverageAngle');
  inRange(coverageRadius, 0, 100000, 'coverageRadius');
  inRange(fps, 1, 240, 'fps');

  const protocol = normaliseProtocol(input.protocol);
  const eventId = input.eventId || null;

  await assertReferencesExist({ ...input, eventId });
  await assertCameraIdFree(input.cameraId!.trim(), eventId);

  const camera = await prisma.camera.create({
    data: {
      cameraId: input.cameraId!.trim(),
      name: input.name!.trim(),
      location: input.location!.trim(),
      ipAddress: input.ipAddress?.trim() || '',
      rtspUrl: input.rtspUrl!.trim(),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      coverageAngle: coverageAngle ?? null,
      coverageRadius: coverageRadius ?? null,
      isPtz: Boolean(input.isPtz),
      vendor: input.vendor?.trim() || null,
      model: input.model?.trim() || null,
      protocol: protocol ?? null,
      onvifUrl: input.onvifUrl?.trim() || null,
      username: input.username?.trim() || null,
      resolution: input.resolution?.trim() || null,
      fps: fps === null || fps === undefined ? null : Math.round(fps),
      departmentId: input.departmentId || null,
      siteId: input.siteId || null,
      eventId,
      // status stays at its UNKNOWN default and lastSeenAt at null: a camera that
      // has just been typed into a form has not been reached yet.
      ...buildCredentialFields(input),
    },
    include: cameraInclude,
  });

  return formatCamera(camera);
}

export async function updateCamera(id: string, input: CameraInput) {
  const existing = await prisma.camera.findUnique({
    where: { id },
    select: { id: true, eventId: true, cameraId: true, latitude: true, longitude: true },
  });
  if (!existing) return null;

  const latitude = optionalNumber(input.latitude, 'latitude');
  const longitude = optionalNumber(input.longitude, 'longitude');
  const coverageAngle = optionalNumber(input.coverageAngle, 'coverageAngle');
  const coverageRadius = optionalNumber(input.coverageRadius, 'coverageRadius');
  const fps = optionalNumber(input.fps, 'fps');

  // A partial update can leave one half of the pair untouched, so validate the
  // pair as it will be after the write, not just the fields that were sent.
  validateCoordinatePair(
    latitude === undefined ? existing.latitude : latitude,
    longitude === undefined ? existing.longitude : longitude
  );
  inRange(coverageAngle, 0, 360, 'coverageAngle');
  inRange(coverageRadius, 0, 100000, 'coverageRadius');
  inRange(fps, 1, 240, 'fps');

  const protocol = normaliseProtocol(input.protocol);
  const nextEventId = input.eventId === undefined ? existing.eventId : input.eventId || null;

  await assertReferencesExist({ ...input, eventId: nextEventId ?? undefined });

  const nextCameraId = input.cameraId?.trim() ?? existing.cameraId;
  if (nextCameraId !== existing.cameraId || nextEventId !== existing.eventId) {
    await assertCameraIdFree(nextCameraId, nextEventId, id);
  }

  const data: Prisma.CameraUpdateInput = {
    ...(input.cameraId !== undefined ? { cameraId: nextCameraId } : {}),
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.location !== undefined ? { location: input.location.trim() } : {}),
    ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress?.trim() || '' } : {}),
    ...(input.rtspUrl !== undefined ? { rtspUrl: input.rtspUrl.trim() } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(coverageAngle !== undefined ? { coverageAngle } : {}),
    ...(coverageRadius !== undefined ? { coverageRadius } : {}),
    ...(input.isPtz !== undefined ? { isPtz: Boolean(input.isPtz) } : {}),
    ...(input.vendor !== undefined ? { vendor: input.vendor?.trim() || null } : {}),
    ...(input.model !== undefined ? { model: input.model?.trim() || null } : {}),
    ...(protocol !== undefined ? { protocol } : {}),
    ...(input.onvifUrl !== undefined ? { onvifUrl: input.onvifUrl?.trim() || null } : {}),
    ...(input.username !== undefined ? { username: input.username?.trim() || null } : {}),
    ...(input.resolution !== undefined ? { resolution: input.resolution?.trim() || null } : {}),
    ...(fps !== undefined ? { fps: fps === null ? null : Math.round(fps) } : {}),
    ...buildCredentialFields(input),
  };

  if (input.departmentId !== undefined) {
    data.department = input.departmentId
      ? { connect: { id: input.departmentId } }
      : { disconnect: true };
  }
  if (input.siteId !== undefined) {
    data.site = input.siteId ? { connect: { id: input.siteId } } : { disconnect: true };
  }
  if (input.eventId !== undefined) {
    data.event = nextEventId ? { connect: { id: nextEventId } } : { disconnect: true };
  }

  const camera = await prisma.camera.update({ where: { id }, data, include: cameraInclude });
  return formatCamera(camera);
}

export async function deleteCamera(id: string) {
  const existing = await prisma.camera.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;

  await prisma.camera.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Departments and sites
// ---------------------------------------------------------------------------

export async function listDepartments() {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { cameras: true, sites: true } } },
  });

  return departments.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    contactName: d.contactName,
    contactPhone: d.contactPhone,
    cameraCount: d._count.cameras,
    siteCount: d._count.sites,
  }));
}

export async function listSites(departmentId?: string) {
  const sites = await prisma.site.findMany({
    where: departmentId ? { departmentId } : undefined,
    orderBy: { name: 'asc' },
    include: {
      department: { select: { id: true, code: true, name: true } },
      _count: { select: { cameras: true } },
    },
  });

  return sites.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    department: s.department,
    cameraCount: s._count.cameras,
  }));
}

// ---------------------------------------------------------------------------
// Registry statistics
// ---------------------------------------------------------------------------

/**
 * Every figure below is a COUNT over the cameras table. `lastHealthCheckAt` is
 * null when no probe has ever run, which is what the UI shows until Phase 2's
 * health checker starts writing rows.
 */
export async function getRegistryStats() {
  const [byStatus, total, located, ptz, attached, byDepartment, lastCheck] = await Promise.all([
    prisma.camera.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.camera.count(),
    prisma.camera.count({ where: { latitude: { not: null } } }),
    prisma.camera.count({ where: { isPtz: true } }),
    prisma.camera.count({ where: { eventId: { not: null } } }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, _count: { select: { cameras: true } } },
    }),
    prisma.cameraHealth.findFirst({ orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const key of Object.keys(CameraStatus)) statusCounts[key] = 0;
  for (const row of byStatus) statusCounts[row.status] = row._count._all;

  return {
    total,
    byStatus: statusCounts,
    located,
    unlocated: total - located,
    ptz,
    attachedToEvent: attached,
    registryOnly: total - attached,
    byDepartment: byDepartment.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      cameraCount: d._count.cameras,
    })),
    lastHealthCheckAt: lastCheck?.checkedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Playable stream URLs
// ---------------------------------------------------------------------------

// A browser cannot play RTSP. MediaMTX republishes each path as HLS and WebRTC,
// and these are the bases those are served from.
const streamBases = () => ({
  rtsp: (process.env.MEDIAMTX_RTSP_BASE || 'rtsp://localhost:8554').replace(/\/+$/, ''),
  hls: (process.env.MEDIAMTX_HLS_BASE || 'http://localhost:8888').replace(/\/+$/, ''),
  webrtc: (process.env.MEDIAMTX_WEBRTC_BASE || 'http://localhost:8889').replace(/\/+$/, ''),
});

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '554'}`;
  } catch {
    return null;
  }
}

export interface StreamEndpoints {
  cameraId: string;
  name: string;
  status: CameraStatus;
  lastSeenAt: Date | null;
  rtspUrl: string;
  /** False whenever the server cannot honestly offer a browser-playable URL. */
  playable: boolean;
  hlsUrl: string | null;
  webrtcUrl: string | null;
  /** Why it is not playable. Null when it is. */
  reason: string | null;
}

/**
 * Resolves the URLs a browser can actually open for a camera.
 *
 * The HLS and WebRTC URLs are only offered when the camera's RTSP URL points at
 * the configured stream server, because only then does republishing exist. For
 * any other host the endpoint says so instead of composing a URL that would
 * quietly 404 in a video element.
 */
export async function getCameraStream(id: string): Promise<StreamEndpoints | null> {
  const camera = await prisma.camera.findUnique({
    where: { id },
    select: {
      cameraId: true,
      name: true,
      status: true,
      lastSeenAt: true,
      rtspUrl: true,
    },
  });

  if (!camera) return null;

  const bases = streamBases();
  const base = {
    cameraId: camera.cameraId,
    name: camera.name,
    status: camera.status,
    lastSeenAt: camera.lastSeenAt,
    rtspUrl: camera.rtspUrl,
    hlsUrl: null,
    webrtcUrl: null,
  };

  const rtspUrl = (camera.rtspUrl || '').trim();
  if (rtspUrl === '') {
    return {
      ...base,
      playable: false,
      reason: 'No stream URL is configured for this camera.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rtspUrl);
  } catch {
    return { ...base, playable: false, reason: `"${rtspUrl}" is not a valid stream URL.` };
  }

  if (hostOf(rtspUrl) !== hostOf(bases.rtsp)) {
    return {
      ...base,
      playable: false,
      reason:
        `This camera streams from ${parsed.host}, which is not the configured stream server ` +
        `(${new URL(bases.rtsp).host}). Only cameras published through that server can be ` +
        'replayed in a browser.',
    };
  }

  const path = parsed.pathname.replace(/^\/+/, '');
  if (path === '') {
    return { ...base, playable: false, reason: 'The stream URL names no path on the server.' };
  }

  return {
    ...base,
    playable: true,
    hlsUrl: `${bases.hls}/${path}/index.m3u8`,
    webrtcUrl: `${bases.webrtc}/${path}`,
    reason: null,
  };
}
