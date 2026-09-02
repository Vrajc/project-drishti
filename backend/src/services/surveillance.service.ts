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

// ---------------------------------------------------------------------------
// Estate crowd readings
// ---------------------------------------------------------------------------

/**
 * The latest counted occupancy for every zone defined on a registry camera.
 *
 * This is the estate-wide counterpart to the event-scoped crowd endpoints: it
 * answers "how busy is the estate right now" without an event existing, which
 * is what makes crowd analytics available to a police operator at all.
 *
 * It reads CrowdDensity and nothing else. While no detector is running the list
 * comes back empty and `readings: 0`, and the UI must render that as "no camera
 * has reported a count yet" rather than as an estate with nobody in it. Those
 * are different claims and only one of them is true.
 */
export async function getEstateCrowd(filter: { eventId?: string } = {}) {
  // Scoped to one event, this answers the organizer's question instead: how
  // busy are the zones on the cameras this event has been given. It is the
  // same reading from the same table - an event does not get its own counting
  // pipeline, it gets the cameras it borrowed from the registry.
  const zones = await prisma.zone.findMany({
    where: filter.eventId
      ? { cameraId: { not: null }, camera: { eventId: filter.eventId } }
      : { cameraId: { not: null } },
    select: {
      id: true,
      zoneId: true,
      name: true,
      maxCapacity: true,
      camera: {
        select: {
          id: true,
          cameraId: true,
          name: true,
          location: true,
          status: true,
          latitude: true,
          longitude: true,
          site: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  // One query per zone would be N+1; instead take the recent readings for all
  // of them at once and reduce to the newest per zone in memory.
  const zoneIds = zones.map((z) => z.id);

  const readings = zoneIds.length
    ? await prisma.crowdDensity.findMany({
        where: { zoneId: { in: zoneIds } },
        orderBy: { timestamp: 'desc' },
        take: zoneIds.length * 5,
        select: {
          id: true,
          zoneId: true,
          peopleCount: true,
          densityPercentage: true,
          timestamp: true,
          confidence: true,
        },
      })
    : [];

  const latest = new Map<string, (typeof readings)[number]>();
  for (const reading of readings) {
    if (reading.zoneId && !latest.has(reading.zoneId)) latest.set(reading.zoneId, reading);
  }

  const totalReadings = await prisma.crowdDensity.count(
    filter.eventId ? { where: { eventId: filter.eventId } } : undefined
  );

  return {
    zones: zones.map((zone) => {
      const reading = latest.get(zone.id) ?? null;

      return {
        id: zone.id,
        zoneId: zone.zoneId,
        name: zone.name,
        maxCapacity: zone.maxCapacity,
        camera: zone.camera,
        // Null means no count has ever been recorded for this zone. Callers
        // must print an empty state, never a zero occupancy.
        latest: reading
          ? {
              peopleCount: reading.peopleCount,
              densityPercentage: reading.densityPercentage,
              timestamp: reading.timestamp,
              confidence: reading.confidence,
              occupancyRatio: zone.maxCapacity > 0 ? reading.peopleCount / zone.maxCapacity : null,
            }
          : null,
      };
    }),
    zonesDefined: zones.length,
    zonesReporting: latest.size,
    readings: totalReadings,
  };
}

// ---------------------------------------------------------------------------
// Assigning registry cameras to an event
// ---------------------------------------------------------------------------

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Attaches a registry camera to an event, or detaches it.
 *
 * This is the step that turns the standalone estate into an event's camera set,
 * and it is deliberately narrow about who may do it. An organizer may only
 * attach a camera to an event they own, and may only detach one that is
 * currently on an event they own - otherwise an organizer could quietly take a
 * camera off another organizer's live event, or claim one that is already in
 * use elsewhere.
 */
export async function setCameraAssignment(
  cameraId: string,
  eventId: string | null,
  actor: { userId: string; role: string }
) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, cameraId: true, eventId: true },
  });
  if (!camera) return null;

  const isOperator = actor.role === 'admin' || actor.role === 'police';

  if (!isOperator) {
    // Detaching: the camera must currently be on one of the actor's events.
    if (camera.eventId) {
      const current = await prisma.event.findUnique({
        where: { id: camera.eventId },
        select: { organizerId: true, name: true },
      });
      if (current?.organizerId !== actor.userId) {
        throw new ForbiddenError(
          `Camera "${camera.cameraId}" is assigned to an event you do not organise.`
        );
      }
    }

    // Attaching: the target event must be one of the actor's.
    if (eventId) {
      const target = await prisma.event.findUnique({
        where: { id: eventId },
        select: { organizerId: true },
      });
      if (!target) throw new ValidationError(`Event "${eventId}" does not exist`);
      if (target.organizerId !== actor.userId) {
        throw new ForbiddenError('You can only assign cameras to an event you organise.');
      }
    }
  } else if (eventId) {
    const target = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!target) throw new ValidationError(`Event "${eventId}" does not exist`);
  }

  // A camera already on another event is moved rather than duplicated, but the
  // caller is told, because taking a camera off a live event is not a quiet act.
  if (eventId && camera.eventId && camera.eventId !== eventId) {
    const previous = await prisma.event.findUnique({
      where: { id: camera.eventId },
      select: { name: true },
    });
    if (previous && !isOperator) {
      throw new ForbiddenError(
        `Camera "${camera.cameraId}" is already assigned to "${previous.name}". ` +
          'Release it there first.'
      );
    }
  }

  // The registry keeps its own cameraId when a camera joins an event; the
  // composite key is (eventId, cameraId), so a clash is possible and refused
  // with a readable message rather than a raw P2002.
  await assertCameraIdFree(camera.cameraId, eventId, camera.id);

  const updated = await prisma.camera.update({
    where: { id: cameraId },
    data: eventId ? { event: { connect: { id: eventId } } } : { event: { disconnect: true } },
    include: cameraInclude,
  });

  return formatCamera(updated);
}

// ---------------------------------------------------------------------------
// Counting zones on a camera
//
// A CrowdDensity row is a count of people inside a zone, and until this existed
// there was no way to create one: Zone rows with a cameraId could only be
// written by hand against the database. Every crowd figure in the product -
// the estate view, an event's crowd flow, the ZONE_CAPACITY_BREACH rule -
// depends on a zone existing, so the whole counting half of the platform was
// unreachable through its own interface.
//
// GEOMETRY
// --------
// Vertices are percentages of the camera frame, 0-100 on each axis, not pixels.
// The detector scales zone geometry from a stated reference canvas into the
// frame it actually captured (see ai-service/zones.py, which refuses to guess
// one); percentages make that reference a constant - 100 x 100 - so a zone
// stays correct when a camera is re-encoded at a different resolution, and no
// part of the system has to remember what canvas an operator drew on.
// ---------------------------------------------------------------------------

/** The reference canvas zone vertices are expressed against. */
export const ZONE_REFERENCE_SIZE = { width: 100, height: 100 };

export interface ZoneVertex {
  x: number;
  y: number;
}

export interface CameraZoneInput {
  name?: unknown;
  maxCapacity?: unknown;
  coordinates?: unknown;
  color?: unknown;
}

function parseVertices(raw: unknown): ZoneVertex[] {
  if (!Array.isArray(raw)) {
    throw new ValidationError('coordinates must be an array of {x, y} vertices');
  }

  const vertices = raw.map((vertex: any, i: number) => {
    const x = Number(vertex?.x);
    const y = Number(vertex?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new ValidationError(`Vertex ${i + 1} needs numeric x and y`);
    }
    // Out of range means the caller is sending pixels, and a polygon in the
    // wrong units counts the wrong people rather than failing visibly.
    if (x < 0 || x > 100 || y < 0 || y > 100) {
      throw new ValidationError(
        `Vertex ${i + 1} is outside the frame: x and y are percentages of it, 0 to 100`
      );
    }
    return { x, y };
  });

  if (vertices.length < 3) {
    throw new ValidationError('A zone needs at least three vertices to enclose an area');
  }

  return vertices;
}

function parseCapacity(raw: unknown): number {
  const capacity = Number(raw);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new ValidationError(
      'maxCapacity must be above zero: density is reported as a percentage of it'
    );
  }
  return Math.round(capacity);
}

/**
 * The zones defined on one camera, with the reference canvas they are drawn
 * against - which is the exact payload the detector's worker needs.
 */
export async function listCameraZones(cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, cameraId: true, name: true },
  });
  if (!camera) return null;

  const zones = await prisma.zone.findMany({
    where: { cameraId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      zoneId: true,
      name: true,
      coordinates: true,
      maxCapacity: true,
      color: true,
      createdAt: true,
    },
  });

  return { camera, zones, zoneReferenceSize: ZONE_REFERENCE_SIZE };
}

export async function createCameraZone(cameraId: string, input: CameraZoneInput) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true },
  });
  if (!camera) return null;

  const name = String(input.name ?? '').trim();
  if (!name) throw new ValidationError('A zone needs a name');

  const coordinates = parseVertices(input.coordinates);
  const maxCapacity = parseCapacity(input.maxCapacity);

  // zoneId is the human-facing handle. It is unique per camera through the
  // partial index added with the registry, so it is derived from the name and
  // disambiguated rather than left to collide.
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zone';
  const taken = new Set(
    (await prisma.zone.findMany({ where: { cameraId }, select: { zoneId: true } })).map(
      (z) => z.zoneId
    )
  );
  let zoneId = base;
  for (let suffix = 2; taken.has(zoneId); suffix += 1) zoneId = `${base}-${suffix}`;

  return prisma.zone.create({
    data: {
      cameraId,
      // Never both: zones_scope_check enforces that a zone belongs to a camera
      // or to an event, and a counting zone is drawn on a camera.
      eventId: null,
      zoneId,
      name,
      coordinates: coordinates as any,
      maxCapacity,
      color: input.color ? String(input.color) : null,
    },
  });
}

export async function updateCameraZone(zoneId: string, input: CameraZoneInput) {
  const existing = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true, cameraId: true },
  });
  if (!existing) return null;
  if (!existing.cameraId) {
    throw new ValidationError('That zone belongs to an event, not a camera');
  }

  const data: any = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new ValidationError('A zone needs a name');
    data.name = name;
  }
  if (input.coordinates !== undefined) data.coordinates = parseVertices(input.coordinates) as any;
  if (input.maxCapacity !== undefined) data.maxCapacity = parseCapacity(input.maxCapacity);
  if (input.color !== undefined) data.color = input.color ? String(input.color) : null;

  return prisma.zone.update({ where: { id: zoneId }, data });
}

/**
 * Deleting a zone deletes the readings counted inside it - CrowdDensity cascades
 * on the zone foreign key. The caller is told how many, because that history is
 * the evidence behind any density figure already reported from it.
 */
export async function deleteCameraZone(zoneId: string) {
  const existing = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true, cameraId: true, name: true },
  });
  if (!existing) return null;
  if (!existing.cameraId) {
    throw new ValidationError('That zone belongs to an event, not a camera');
  }

  const readings = await prisma.crowdDensity.count({ where: { zoneId } });
  await prisma.zone.delete({ where: { id: zoneId } });
  return { id: zoneId, name: existing.name, readingsDeleted: readings };
}

// ---------------------------------------------------------------------------
// Creating departments and sites
//
// Both were read-only: listDepartments and listSites served filter dropdowns
// and camera forms, and the only way a row got there was `npm run seed:cameras`.
// A department is also what a registry dispatch unit hangs off - the scope
// check requires an event or a department - so with no way to create one, the
// estate side of dispatch could not be set up through the product at all.
// ---------------------------------------------------------------------------

/** Codes are the human handle and are unique; they are compared case-folded. */
function parseCode(raw: unknown, label: string): string {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!code) throw new ValidationError(`${label} needs a code`);
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(code)) {
    throw new ValidationError(`${label} code may use letters, digits and hyphens only`);
  }
  return code;
}

function parseName(raw: unknown, label: string): string {
  const name = String(raw ?? '').trim();
  if (!name) throw new ValidationError(`${label} needs a name`);
  return name;
}

/** Optional WGS84 pair. Half a coordinate is not a position, so both or neither. */
function parsePosition(latRaw: unknown, lonRaw: unknown) {
  const hasLat = latRaw !== undefined && latRaw !== null && latRaw !== '';
  const hasLon = lonRaw !== undefined && lonRaw !== null && lonRaw !== '';
  if (!hasLat && !hasLon) return { latitude: null, longitude: null };
  if (hasLat !== hasLon) {
    throw new ValidationError('A position needs both latitude and longitude, or neither');
  }

  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new ValidationError('latitude must be between -90 and 90');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ValidationError('longitude must be between -180 and 180');
  }
  return { latitude, longitude };
}

export async function createDepartment(input: any) {
  const code = parseCode(input?.code, 'A department');
  const name = parseName(input?.name, 'A department');

  const clash = await prisma.department.findUnique({ where: { code } });
  if (clash) throw new ValidationError(`A department with code ${code} already exists`);

  return prisma.department.create({
    data: {
      code,
      name,
      contactName: input?.contactName ? String(input.contactName).trim() : null,
      contactPhone: input?.contactPhone ? String(input.contactPhone).trim() : null,
    },
  });
}

export async function createSite(input: any) {
  const code = parseCode(input?.code, 'A site');
  const name = parseName(input?.name, 'A site');
  const { latitude, longitude } = parsePosition(input?.latitude, input?.longitude);

  const clash = await prisma.site.findUnique({ where: { code } });
  if (clash) throw new ValidationError(`A site with code ${code} already exists`);

  const departmentId = input?.departmentId ? String(input.departmentId) : null;
  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new ValidationError('That department does not exist');
  }

  return prisma.site.create({
    data: {
      code,
      name,
      departmentId,
      address: input?.address ? String(input.address).trim() : null,
      latitude,
      longitude,
    },
  });
}
