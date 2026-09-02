import prisma from '../lib/prisma.js';
import { haversineMetres, toCoordinates } from '../utils/geo.js';
import { normalisePlate } from '../utils/plateMatch.js';

// ============================================================================
// Cross-camera vehicle tracking.
//
// A "trail" here is a sequence of cameras that saw a vehicle, in time order. It
// is NOT a GPS track: every position is the camera's own surveyed location,
// because nothing in this system can place a vehicle within a field of view.
// Both the API and the map label it that way.
//
// Two sightings are linked one of two ways, and the difference is never blurred:
//
//   CERTAIN  - the same normalised plate was read at both. Same plate, same
//              vehicle.
//   PROBABLE - no plate at one end, linked on colour, type and whether the gap
//              between the cameras is physically possible in the time observed.
//              Always carries a computed score and its components, so an
//              operator can judge the inference rather than trust it.
//
// There is no third category. An inferred link is never presented as certain.
// ============================================================================

/** Below this, a vehicle is stationary or the two sightings are the same stop. */
const MIN_PLAUSIBLE_KMH = 2;
/** The band in which an implied speed says nothing suspicious either way. */
const COMFORTABLE_KMH = 80;
/**
 * Above this the link is rejected outright.
 *
 * The distance used is straight-line, which is a LOWER bound on road distance -
 * so the implied speed is a lower bound on the real one. If even that exceeds
 * this, no vehicle could have made the journey, and the link is impossible
 * rather than merely unlikely. That asymmetry is why a straight line is
 * defensible here: it can rule a link out, and never rules one in on its own.
 */
const IMPOSSIBLE_KMH = 150;

/**
 * The highest score an inferred link may reach.
 *
 * Colour, type and plausible timing narrow a link down; they cannot establish
 * identity, because another white car of the same type could have made the same
 * journey. Without the ceiling a perfect agreement scores 1.0, and "PROBABLE -
 * 100%" reads as certainty, which is the one thing an inferred link must never
 * do. Only a plate match identifies a vehicle, and that path returns no score at
 * all because nothing was inferred.
 */
const INFERRED_CEILING = 0.85;

export interface Sighting {
  detectionId: string;
  ts: Date;
  camera: {
    id: string;
    cameraId: string;
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
  };
  plateNumber: string | null;
  plateConfidence: number | null;
  objectClass: string;
  vehicleType: string | null;
  color: string | null;
  confidence: number;
  bbox: unknown;
  snapshotPath: string | null;
  trackId: number | null;
}

export type LinkCertainty = 'CERTAIN' | 'PROBABLE';

export interface TrailLink {
  fromDetectionId: string;
  toDetectionId: string;
  certainty: LinkCertainty;
  /** Null for a CERTAIN link - there is nothing to score, the plates match. */
  score: number | null;
  /** What went into the score, so a human can check the inference. */
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
  /** Cameras in the trail that have never been surveyed, so cannot be mapped. */
  unmappableCameras: string[];
}

const detectionSelect = {
  id: true,
  ts: true,
  plateNumber: true,
  plateNormalised: true,
  plateConfidence: true,
  objectClass: true,
  vehicleType: true,
  color: true,
  confidence: true,
  bbox: true,
  snapshotPath: true,
  trackId: true,
  camera: {
    select: {
      id: true,
      cameraId: true,
      name: true,
      location: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

function toSighting(row: any): Sighting {
  return {
    detectionId: row.id,
    ts: row.ts,
    camera: row.camera,
    plateNumber: row.plateNumber,
    plateConfidence: row.plateConfidence,
    objectClass: row.objectClass,
    vehicleType: row.vehicleType,
    color: row.color,
    confidence: row.confidence,
    bbox: row.bbox,
    snapshotPath: row.snapshotPath,
    trackId: row.trackId,
  };
}

/**
 * How believable the implied speed is, 0..1.
 *
 * Flat at 1 through the comfortable band, tapering to 0 at both ends. A vehicle
 * that appears to have crawled may simply have parked in between, so the low end
 * is a soft penalty; the high end reaches 0 at the impossible speed.
 */
function speedPlausibility(kmh: number): number {
  if (kmh >= IMPOSSIBLE_KMH) return 0;
  if (kmh <= 0) return 0;

  if (kmh < MIN_PLAUSIBLE_KMH) return kmh / MIN_PLAUSIBLE_KMH;
  if (kmh <= COMFORTABLE_KMH) return 1;

  return Math.max(0, (IMPOSSIBLE_KMH - kmh) / (IMPOSSIBLE_KMH - COMFORTABLE_KMH));
}

/**
 * Classifies the link between two consecutive sightings.
 *
 * Returns null when they cannot be linked at all - different plates, or a
 * journey no vehicle could have made.
 */
export function classifyLink(previous: Sighting, next: Sighting): TrailLink | null {
  const secondsApart = Math.max(
    0,
    (next.ts.getTime() - previous.ts.getTime()) / 1000
  );

  const previousPlate = normalisePlate(previous.plateNumber);
  const nextPlate = normalisePlate(next.plateNumber);

  const from = toCoordinates(previous.camera);
  const to = toCoordinates(next.camera);
  const straightLineMetres = from && to ? Math.round(haversineMetres(from, to)) : null;
  const impliedKmh =
    straightLineMetres !== null && secondsApart > 0
      ? Number(((straightLineMetres / secondsApart) * 3.6).toFixed(1))
      : null;

  // Same plate at both ends. Nothing is being inferred, so there is no score.
  if (previousPlate && nextPlate && previousPlate === nextPlate) {
    return {
      fromDetectionId: previous.detectionId,
      toDetectionId: next.detectionId,
      certainty: 'CERTAIN',
      score: null,
      reasoning: {
        plateMatch: true,
        colorMatch: null,
        typeMatch: null,
        straightLineMetres,
        secondsApart,
        impliedKmh,
        note: 'The same plate was read at both cameras.',
      },
    };
  }

  // Two different plates are two different vehicles, whatever else agrees.
  if (previousPlate && nextPlate && previousPlate !== nextPlate) return null;

  // From here it is an inference. It needs both cameras surveyed, because
  // without a distance there is nothing to check the time gap against.
  if (straightLineMetres === null) {
    return null;
  }

  if (impliedKmh !== null && impliedKmh >= IMPOSSIBLE_KMH) {
    return null;
  }

  const colorMatch =
    previous.color !== null && next.color !== null ? previous.color === next.color : null;
  const typeMatch =
    previous.vehicleType !== null && next.vehicleType !== null
      ? previous.vehicleType === next.vehicleType
      : previous.objectClass === next.objectClass;

  // A disagreement on either observed attribute rules the link out. Both are
  // measured from the frame, so a mismatch is evidence against, not absence of
  // evidence.
  if (colorMatch === false || typeMatch === false) return null;

  const speed = impliedKmh === null ? 0 : speedPlausibility(impliedKmh);

  // A ranking aid, not a probability, and capped below certainty. The components
  // are returned alongside it precisely so nobody has to take the single number
  // on trust.
  const agreement =
    0.5 * speed + 0.3 * (colorMatch === true ? 1 : 0) + 0.2 * (typeMatch ? 1 : 0);
  const score = Number((agreement * INFERRED_CEILING).toFixed(3));

  const parts: string[] = [];
  parts.push(
    impliedKmh === null
      ? 'The two sightings share a timestamp, so no speed could be implied.'
      : `${(straightLineMetres / 1000).toFixed(2)} km apart in ${Math.round(secondsApart)}s, ` +
        `implying at least ${impliedKmh} km/h.`
  );
  parts.push(
    colorMatch === true
      ? `Both read as ${next.color}.`
      : 'Colour was not measured at one of the sightings.'
  );
  parts.push(
    'Straight-line distance is a lower bound on the road distance. Colour and type ' +
    'narrow this link down but cannot identify the vehicle, so it is never certain.'
  );

  return {
    fromDetectionId: previous.detectionId,
    toDetectionId: next.detectionId,
    certainty: 'PROBABLE',
    score,
    reasoning: {
      plateMatch: false,
      colorMatch,
      typeMatch,
      straightLineMetres,
      secondsApart,
      impliedKmh,
      note: parts.join(' '),
    },
  };
}

/**
 * Fills the gaps between plate-confirmed sightings with plateless ones the
 * classifier accepts.
 *
 * For each consecutive pair of confirmed sightings it looks only at detections
 * that fall between them in time, on a surveyed camera, and offers each in turn
 * to `classifyLink`. A candidate is threaded in only if the link is accepted -
 * so colour, type and the physical possibility of the journey all had to agree.
 * Anything threaded in this way is linked as PROBABLE and can never read as
 * certain.
 */
async function threadProbableSightings(confirmed: Sighting[]): Promise<Sighting[]> {
  if (confirmed.length < 2) return confirmed;

  const result: Sighting[] = [confirmed[0]];

  for (let index = 1; index < confirmed.length; index += 1) {
    const previous = result[result.length - 1];
    const next = confirmed[index];

    const candidates = await prisma.detection.findMany({
      where: {
        // Plateless only: a row carrying a different plate is a different
        // vehicle, and one carrying this plate is already in `confirmed`.
        plateNormalised: null,
        ts: { gt: previous.ts, lt: next.ts },
        camera: { latitude: { not: null }, longitude: { not: null } },
        ...(next.color ? { color: next.color } : {}),
      },
      select: detectionSelect,
      orderBy: { ts: 'asc' },
      // A bound, so a busy hour between two sightings cannot turn one trail
      // query into thousands of comparisons.
      take: 200,
    });

    let cursor = previous;
    for (const candidate of candidates.map(toSighting)) {
      const link = classifyLink(cursor, candidate);
      if (link?.certainty !== 'PROBABLE') continue;

      // It also has to be able to reach the next confirmed sighting, or it is
      // not on this journey.
      if (!classifyLink(candidate, next)) continue;

      result.push(candidate);
      cursor = candidate;
    }

    result.push(next);
  }

  return result;
}

/**
 * Every sighting of a plate, in time order, with the links between them.
 *
 * Plate-bearing detections are found by normalised plate, so a search typed with
 * spaces or with an O for a zero finds the same vehicle.
 */
export async function getTrailByPlate(
  plate: string,
  options: { from?: Date; to?: Date; limit?: number; includeProbable?: boolean } = {}
): Promise<Trail> {
  const normalised = normalisePlate(plate);
  if (!normalised) {
    return {
      query: { plate, normalised: null },
      sightings: [],
      links: [],
      unmappableCameras: [],
    };
  }

  const rows = await prisma.detection.findMany({
    where: {
      plateNormalised: normalised,
      ...(options.from || options.to
        ? { ts: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    },
    select: detectionSelect,
    orderBy: { ts: 'asc' },
    take: Math.min(Math.max(options.limit ?? 500, 1), 2000),
  });

  const confirmed = rows.map(toSighting);

  // Plate-confirmed sightings alone would make the PROBABLE path unreachable:
  // a query by plate can only ever find rows that carry that plate, so a leg
  // where the plate was not read would silently vanish from the trail and the
  // route would jump over it. Candidate plateless sightings between consecutive
  // confirmed ones are offered to the same classifier, and kept only if it
  // accepts them.
  const sightings =
    options.includeProbable === false
      ? confirmed
      : await threadProbableSightings(confirmed);

  const links: TrailLink[] = [];
  for (let index = 1; index < sightings.length; index += 1) {
    const link = classifyLink(sightings[index - 1], sightings[index]);
    if (link) links.push(link);
  }

  // Named rather than silently dropped: a trail missing a leg because a camera
  // was never surveyed should say so, not look complete.
  const unmappableCameras = [
    ...new Set(
      sightings
        .filter((sighting) => sighting.camera.latitude === null || sighting.camera.longitude === null)
        .map((sighting) => sighting.camera.cameraId)
    ),
  ];

  return { query: { plate, normalised }, sightings, links, unmappableCameras };
}

export interface DetectionSearchFilters {
  cameraId?: string;
  objectClass?: string;
  plate?: string;
  color?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

/**
 * The detection search behind EventSearch.
 *
 * Callers are told the sampling rule alongside the results, because the
 * detections table is a sample and "247 results" must not read as "247 times
 * this vehicle was seen".
 */
export async function searchDetections(filters: DetectionSearchFilters) {
  const where: any = {};

  if (filters.cameraId) where.cameraId = filters.cameraId;
  if (filters.objectClass) where.objectClass = filters.objectClass;
  if (filters.color) where.color = { equals: filters.color, mode: 'insensitive' };

  if (filters.plate) {
    const normalised = normalisePlate(filters.plate);
    // Falls back to the raw text so a partial plate still searches, while an
    // exact-looking query matches through the same normalisation the matcher
    // uses.
    where.OR = normalised
      ? [
          { plateNormalised: { contains: normalised } },
          { plateNumber: { contains: filters.plate, mode: 'insensitive' } },
        ]
      : [{ plateNumber: { contains: filters.plate, mode: 'insensitive' } }];
  }

  if (filters.from || filters.to) {
    where.ts = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const take = Math.min(Math.max(filters.take ?? 100, 1), 1000);
  const skip = Math.max(filters.skip ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.detection.findMany({ where, select: detectionSelect, orderBy: { ts: 'desc' }, skip, take }),
    prisma.detection.count({ where }),
  ]);

  return { detections: rows.map(toSighting), total, skip, take };
}

/** Distinct values actually present, so the filters offer only real options. */
export async function getSearchFacets() {
  const [classes, colors, cameras] = await Promise.all([
    prisma.detection.findMany({ distinct: ['objectClass'], select: { objectClass: true } }),
    prisma.detection.findMany({
      where: { color: { not: null } },
      distinct: ['color'],
      select: { color: true },
    }),
    prisma.camera.findMany({
      where: { detections: { some: {} } },
      select: { id: true, cameraId: true, name: true },
      orderBy: { cameraId: 'asc' },
    }),
  ]);

  return {
    objectClasses: classes.map((row) => row.objectClass).sort(),
    colors: colors.map((row) => row.color).filter(Boolean).sort(),
    cameras,
  };
}
