import { DispatchStatus, DispatchUnitStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { ValidationError } from './surveillance.service.js';
import { haversineMetres, toCoordinates } from '../utils/geo.js';

// ============================================================================
// Dispatch.
//
// This is what makes POLICE an operational role rather than a registry clerk:
// an operator sees incidents across the whole estate, sends a unit, and the
// unit's progress is recorded as it is reported. Every timestamp on a
// DispatchAssignment is written at the moment the corresponding thing actually
// happened, and is null until then.
//
// The page this replaces used to start a setTimeout for a random 2-12 seconds
// and then write status:'resolved' into Postgres, which laundered an invented
// number into Incident.responseTime and from there into two dashboards. Phase
// 0.5 deleted that. Nothing here may reintroduce it: no lifecycle transition
// happens on a timer, only on an operator action.
// ============================================================================

const unitInclude = {
  department: { select: { id: true, code: true, name: true } },
  event: { select: { id: true, name: true } },
} satisfies Prisma.DispatchUnitInclude;

const assignmentInclude = {
  unit: { include: unitInclude },
  dispatcher: { select: { id: true, name: true } },
  // `eventId` decides which realtime rooms an assignment change is pushed to,
  // so it travels with the assignment rather than being fetched again.
  incident: {
    select: { id: true, eventId: true, cameraId: true, status: true, severity: true, description: true },
  },
} satisfies Prisma.DispatchAssignmentInclude;

/** Assignments that still occupy a unit. Anything else frees it again. */
const ACTIVE_DISPATCH_STATUSES: DispatchStatus[] = ['DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'];

export function formatUnit(unit: any) {
  return {
    ...unit,
    _id: unit.id,
    status: unit.status.toLowerCase(),
    // A unit nobody has surveyed has no position. The console lists it as
    // dispatchable but cannot rank it by distance, and says so.
    isLocated: typeof unit.latitude === 'number' && typeof unit.longitude === 'number',
    scope: unit.eventId ? 'event' : 'registry',
  };
}

export function formatAssignment(assignment: any) {
  const { unit, dispatcher, incident, ...rest } = assignment;
  return {
    ...rest,
    _id: assignment.id,
    status: assignment.status.toLowerCase(),
    unit: unit ? formatUnit(unit) : null,
    dispatcherName: dispatcher?.name ?? null,
    incident: incident
      ? {
          ...incident,
          _id: incident.id,
          status: incident.status.toLowerCase(),
          severity: incident.severity.toLowerCase(),
        }
      : null,
    // Derived from two real timestamps, or null. Never estimated.
    acknowledgedInSeconds: secondsBetween(assignment.dispatchedAt, assignment.acknowledgedAt),
    arrivedInSeconds: secondsBetween(assignment.dispatchedAt, assignment.arrivedAt),
    clearedInSeconds: secondsBetween(assignment.dispatchedAt, assignment.clearedAt),
  };
}

function secondsBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitFilters {
  eventId?: string;
  departmentId?: string;
  status?: string;
  /** 'registry' = estate units only, 'event' = event-owned units only. */
  scope?: string;
}

export function buildUnitWhere(filters: UnitFilters): Prisma.DispatchUnitWhereInput {
  const where: Prisma.DispatchUnitWhereInput = {};

  if (filters.eventId) where.eventId = filters.eventId;
  if (filters.departmentId) where.departmentId = filters.departmentId;

  if (filters.scope === 'registry') where.eventId = null;
  if (filters.scope === 'event') where.eventId = { not: null };

  if (filters.status) {
    const status = filters.status.toUpperCase() as DispatchUnitStatus;
    if (!Object.values(DispatchUnitStatus).includes(status)) {
      throw new ValidationError(
        `status must be one of ${Object.values(DispatchUnitStatus).join(', ').toLowerCase()}`
      );
    }
    where.status = status;
  }

  return where;
}

export async function listUnits(filters: UnitFilters) {
  const units = await prisma.dispatchUnit.findMany({
    where: buildUnitWhere(filters),
    include: unitInclude,
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  return units.map(formatUnit);
}

/**
 * Units that could be sent to this incident, nearest first.
 *
 * Ranking is a haversine over two stored coordinate pairs - a real computation
 * over real data. Units with no surveyed position are not dropped (they are
 * still dispatchable by a human who knows where they are) but they sort last
 * and carry `straightLineM: null`, because an unknown distance must not be
 * rendered as a short one.
 */
export async function rankUnitsForIncident(incidentId: string) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, eventId: true, latitude: true, longitude: true },
  });

  if (!incident) {
    throw new ValidationError('Incident not found');
  }

  // An event incident draws on that event's own units plus the estate's; a
  // camera incident on the estate's alone. Police can always see the estate.
  const where: Prisma.DispatchUnitWhereInput = incident.eventId
    ? { OR: [{ eventId: incident.eventId }, { eventId: null }] }
    : { eventId: null };

  const units = await prisma.dispatchUnit.findMany({
    where,
    include: unitInclude,
    orderBy: { name: 'asc' },
  });

  const origin = toCoordinates(incident);

  const ranked = units.map((unit) => {
    const unitPosition = toCoordinates(unit);
    const straightLineM =
      origin && unitPosition ? Math.round(haversineMetres(origin, unitPosition)) : null;

    return {
      ...formatUnit(unit),
      straightLineM,
      // Null until a routing service answers. The console prints "ETA
      // unavailable" rather than dividing distance by an assumed speed.
      etaSeconds: null as number | null,
    };
  });

  ranked.sort((a, b) => {
    // Available units first - a busy unit is still listed, because an operator
    // may need to reassign one, but it should never head the list.
    const availability = Number(b.status === 'available') - Number(a.status === 'available');
    if (availability !== 0) return availability;

    if (a.straightLineM === null && b.straightLineM === null) return 0;
    if (a.straightLineM === null) return 1;
    if (b.straightLineM === null) return -1;
    return a.straightLineM - b.straightLineM;
  });

  return {
    incidentId: incident.id,
    /** False when the incident has no coordinates, so the client can say why nothing is ranked. */
    rankedByDistance: origin !== null,
    units: ranked,
  };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function listAssignmentsForIncident(incidentId: string) {
  const assignments = await prisma.dispatchAssignment.findMany({
    where: { incidentId },
    include: assignmentInclude,
    orderBy: { dispatchedAt: 'desc' },
  });

  return assignments.map(formatAssignment);
}

/**
 * Send a unit to an incident.
 *
 * Both rows are written in one transaction: an assignment that exists while its
 * unit still reads AVAILABLE would show a free unit that is already committed,
 * and an operator would send it twice.
 */
export async function dispatchUnit(input: {
  incidentId: string;
  unitId: string;
  dispatchedBy: string;
  notes?: string | null;
}) {
  const { incidentId, unitId, dispatchedBy } = input;

  const [incident, unit] = await Promise.all([
    prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, eventId: true, status: true, latitude: true, longitude: true },
    }),
    prisma.dispatchUnit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true, eventId: true, status: true, latitude: true, longitude: true },
    }),
  ]);

  if (!incident) throw new ValidationError('Incident not found');
  if (!unit) throw new ValidationError('Dispatch unit not found');

  if (incident.status === 'RESOLVED') {
    throw new ValidationError('Cannot dispatch to an incident that is already resolved');
  }

  if (unit.status === 'OFFLINE') {
    throw new ValidationError(`${unit.name} is offline and cannot be dispatched`);
  }

  // An event's own unit belongs to that event. Estate units (eventId null)
  // serve anything.
  if (unit.eventId && unit.eventId !== incident.eventId) {
    throw new ValidationError(`${unit.name} belongs to a different event`);
  }

  const existing = await prisma.dispatchAssignment.findFirst({
    where: { incidentId, unitId, status: { in: ACTIVE_DISPATCH_STATUSES } },
    select: { id: true },
  });

  if (existing) {
    throw new ValidationError(`${unit.name} is already assigned to this incident`);
  }

  const origin = toCoordinates(incident);
  const unitPosition = toCoordinates(unit);
  const straightLineM =
    origin && unitPosition ? Math.round(haversineMetres(origin, unitPosition)) : null;

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.dispatchAssignment.create({
      data: {
        incidentId,
        unitId,
        dispatchedBy,
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        straightLineM,
        // etaSeconds and routeDistanceM stay null: no routing service has been
        // asked, so there is no answer to record.
        notes: input.notes?.trim() || null,
      },
      include: assignmentInclude,
    });

    await tx.dispatchUnit.update({
      where: { id: unitId },
      data: { status: 'DISPATCHED' },
    });

    // A dispatched incident is being worked on. This is the one status change
    // the system makes on its own, and it reflects a real operator action.
    if (incident.status === 'OPEN') {
      await tx.incident.update({
        where: { id: incidentId },
        data: { status: 'INVESTIGATING' },
      });
    }

    return created;
  });

  return formatAssignment(assignment);
}

const TRANSITIONS: Record<string, { from: DispatchStatus[]; to: DispatchStatus; stamp: string }> = {
  acknowledge: { from: ['DISPATCHED'], to: 'ACKNOWLEDGED', stamp: 'acknowledgedAt' },
  arrive: { from: ['DISPATCHED', 'ACKNOWLEDGED'], to: 'ARRIVED', stamp: 'arrivedAt' },
  clear: { from: ['DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'], to: 'CLEARED', stamp: 'clearedAt' },
  cancel: { from: ['DISPATCHED', 'ACKNOWLEDGED', 'ARRIVED'], to: 'CANCELLED', stamp: 'clearedAt' },
};

export const DISPATCH_ACTIONS = Object.keys(TRANSITIONS);

/**
 * Advance an assignment. The timestamp for the new state is written as `now`,
 * because the transition is being reported now - there is no back-dating and no
 * inference of a moment nobody observed.
 */
export async function advanceAssignment(input: {
  assignmentId: string;
  action: string;
  notes?: string | null;
}) {
  const transition = TRANSITIONS[input.action];
  if (!transition) {
    throw new ValidationError(`action must be one of ${DISPATCH_ACTIONS.join(', ')}`);
  }

  const assignment = await prisma.dispatchAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { id: true, status: true, unitId: true, incidentId: true },
  });

  if (!assignment) throw new ValidationError('Dispatch assignment not found');

  if (!transition.from.includes(assignment.status)) {
    throw new ValidationError(
      `Cannot ${input.action} an assignment that is ${assignment.status.toLowerCase()}`
    );
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.dispatchAssignment.update({
      where: { id: assignment.id },
      data: {
        status: transition.to,
        [transition.stamp]: now,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      include: assignmentInclude,
    });

    // A unit is free again once it has no live assignment left anywhere - not
    // merely once this one ended, because it may be committed to a second
    // incident.
    const stillCommitted = await tx.dispatchAssignment.count({
      where: {
        unitId: assignment.unitId,
        status: { in: ACTIVE_DISPATCH_STATUSES },
        id: { not: assignment.id },
      },
    });

    await tx.dispatchUnit.update({
      where: { id: assignment.unitId },
      data: {
        status: stillCommitted > 0 ? 'DISPATCHED' : 'AVAILABLE',
      },
    });

    return result;
  });

  return formatAssignment(updated);
}

/**
 * Estate-wide dispatch counters, every one a COUNT over real rows.
 * Response-time figures are computed only over assignments that genuinely
 * reached the state being measured.
 */
export async function getDispatchStats() {
  const [unitsByStatus, assignmentsByStatus, acknowledged, arrived] = await Promise.all([
    prisma.dispatchUnit.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.dispatchAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.dispatchAssignment.findMany({
      where: { acknowledgedAt: { not: null } },
      select: { dispatchedAt: true, acknowledgedAt: true },
    }),
    prisma.dispatchAssignment.findMany({
      where: { arrivedAt: { not: null } },
      select: { dispatchedAt: true, arrivedAt: true },
    }),
  ]);

  const meanSeconds = (rows: Array<{ dispatchedAt: Date; [k: string]: any }>, field: string) => {
    if (rows.length === 0) return null;
    const total = rows.reduce(
      (sum, row) => sum + (row[field].getTime() - row.dispatchedAt.getTime()) / 1000,
      0
    );
    return Math.round(total / rows.length);
  };

  const toMap = (rows: Array<{ status: string; _count: { _all: number } }>) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status.toLowerCase()] = row._count._all;
      return acc;
    }, {});

  return {
    units: toMap(unitsByStatus),
    assignments: toMap(assignmentsByStatus),
    // Null, not zero, when nothing has been acknowledged yet. Zero would read
    // as "instant", which is a claim about performance nobody has earned.
    meanAcknowledgeSeconds: meanSeconds(acknowledged, 'acknowledgedAt'),
    meanArrivalSeconds: meanSeconds(arrived, 'arrivedAt'),
    measuredFrom: {
      acknowledgements: acknowledged.length,
      arrivals: arrived.length,
    },
  };
}
