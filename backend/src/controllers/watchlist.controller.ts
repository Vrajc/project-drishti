import { Response } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { normalisePlate } from '../utils/plateMatch.js';
import { invalidateWatchlistCache } from '../services/matchEngine.service.js';

// The watchlist. Adding an entry is an operational act with consequences, so
// every row records who issued it, under which case number, and when it expires.
// `issuedBy` comes from the verified token, never from the request body.

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const ENTITY_TYPES = ['VEHICLE', 'PERSON'] as const;

class InvalidEntry extends Error {}

function fail(res: Response, error: any, fallback: string) {
  if (error instanceof InvalidEntry) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Watchlist entry not found' });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

function parseExpiry(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const when = new Date(String(value));
  if (Number.isNaN(when.getTime())) throw new InvalidEntry(`expiresAt "${value}" is not a date`);
  return when;
}

/**
 * Builds the stored fields from a request body.
 *
 * A VEHICLE entry without a usable plate is refused rather than stored inert:
 * an entry the match engine can never fire on would sit in the console looking
 * like active surveillance while doing nothing.
 */
function buildEntry(body: any, issuedBy: string) {
  const entityType = String(body.entityType || 'VEHICLE').toUpperCase();
  if (!ENTITY_TYPES.includes(entityType as any)) {
    throw new InvalidEntry(`entityType must be one of ${ENTITY_TYPES.join(', ')}`);
  }

  const severity = String(body.severity || 'MEDIUM').toUpperCase();
  if (!SEVERITIES.includes(severity as any)) {
    throw new InvalidEntry(`severity must be one of ${SEVERITIES.join(', ')}`);
  }

  const caseNumber = String(body.caseNumber || '').trim();
  if (caseNumber === '') throw new InvalidEntry('caseNumber is required');

  const caseType = String(body.caseType || '').trim();
  if (caseType === '') throw new InvalidEntry('caseType is required');

  const plateNumber = body.plateNumber ? String(body.plateNumber).trim() : null;
  const plateNormalised = normalisePlate(plateNumber);

  if (entityType === 'VEHICLE') {
    if (!plateNormalised) {
      throw new InvalidEntry('A vehicle entry needs a plate number the matcher can read');
    }
    if (plateNormalised.length < 4) {
      throw new InvalidEntry(
        `"${plateNumber}" normalises to ${plateNormalised.length} character(s). Four is the ` +
          'minimum: a shorter fragment is within one edit of a great many real plates.'
      );
    }
  }

  const personName = body.personName ? String(body.personName).trim() : null;
  if (entityType === 'PERSON' && !personName) {
    throw new InvalidEntry('A person entry needs a name');
  }

  return {
    entityType: entityType as 'VEHICLE' | 'PERSON',
    plateNumber,
    plateNormalised,
    vehicleMakeModel: body.vehicleMakeModel ? String(body.vehicleMakeModel).trim() : null,
    color: body.color ? String(body.color).trim() : null,
    personName,
    photoUrl: body.photoUrl ? String(body.photoUrl).trim() : null,
    caseNumber,
    caseType,
    severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    issuedBy,
    expiresAt: parseExpiry(body.expiresAt),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    notes: body.notes ? String(body.notes).trim() : null,
  };
}

const entryInclude = {
  issuer: { select: { id: true, name: true, email: true } },
  _count: { select: { alerts: true } },
} as const;

function serialise(entry: any) {
  const { _count, ...rest } = entry;
  return { ...rest, alertCount: _count?.alerts ?? 0 };
}

export const listEntries = async (req: AuthRequest, res: Response) => {
  try {
    const { q, entityType, active } = req.query;
    const where: any = {};

    if (entityType) where.entityType = String(entityType).toUpperCase();
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    if (q) {
      const search = String(q).trim();
      const normalised = normalisePlate(search);
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { caseNumber: { contains: search, mode: 'insensitive' } },
        { personName: { contains: search, mode: 'insensitive' } },
        { vehicleMakeModel: { contains: search, mode: 'insensitive' } },
        // So a search typed with spaces still finds a plate stored without them.
        ...(normalised ? [{ plateNormalised: { contains: normalised } }] : []),
      ];
    }

    const entries = await prisma.watchlistEntry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ isActive: 'desc' }, { issuedAt: 'desc' }],
      take: 500,
    });

    res.status(200).json({ success: true, data: entries.map(serialise), total: entries.length });
  } catch (error: any) {
    fail(res, error, 'Failed to fetch the watchlist');
  }
};

export const createEntry = async (req: AuthRequest, res: Response) => {
  try {
    const issuedBy = req.user?.userId;
    if (!issuedBy) return res.status(401).json({ success: false, message: 'Authentication required' });

    const entry = await prisma.watchlistEntry.create({
      data: buildEntry(req.body, issuedBy),
      include: entryInclude,
    });

    // The engine caches active entries for a few seconds; clearing it here is
    // what makes a newly added plate live immediately rather than on the next
    // refresh.
    invalidateWatchlistCache();

    res.status(201).json({ success: true, data: serialise(entry) });
  } catch (error: any) {
    fail(res, error, 'Failed to create the watchlist entry');
  }
};

export const updateEntry = async (req: AuthRequest, res: Response) => {
  try {
    const issuedBy = req.user?.userId;
    if (!issuedBy) return res.status(401).json({ success: false, message: 'Authentication required' });

    const existing = await prisma.watchlistEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Watchlist entry not found' });

    // Merged with what is stored so a partial update cannot drop a plate and
    // leave a vehicle entry the matcher can never fire on.
    const merged = buildEntry({ ...existing, ...req.body }, existing.issuedBy);

    const entry = await prisma.watchlistEntry.update({
      where: { id: req.params.id },
      data: merged,
      include: entryInclude,
    });

    invalidateWatchlistCache();
    res.status(200).json({ success: true, data: serialise(entry) });
  } catch (error: any) {
    fail(res, error, 'Failed to update the watchlist entry');
  }
};

export const deleteEntry = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.watchlistEntry.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { alerts: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Watchlist entry not found' });

    // Deleting cascades to its alerts, which is a loss of record. Deactivating
    // keeps the history and stops the matching, which is almost always what is
    // wanted, so the destructive path has to be asked for explicitly.
    if (existing._count.alerts > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        success: false,
        message:
          `This entry has raised ${existing._count.alerts} alert(s). Deleting it removes them ` +
          'from the record. Deactivate it instead to stop matching, or repeat with ?force=true.',
      });
    }

    await prisma.watchlistEntry.delete({ where: { id: req.params.id } });
    invalidateWatchlistCache();
    res.status(200).json({ success: true, message: 'Watchlist entry deleted' });
  } catch (error: any) {
    fail(res, error, 'Failed to delete the watchlist entry');
  }
};

/**
 * CSV import for stolen-vehicle lists.
 *
 * Reports per-row outcomes rather than a single count: a caller who uploads 500
 * plates needs to know which four were rejected and why, not that "496
 * succeeded". Rows are validated individually, so one bad line does not lose
 * the rest.
 */
export const importCsv = async (req: AuthRequest, res: Response) => {
  try {
    const issuedBy = req.user?.userId;
    if (!issuedBy) return res.status(401).json({ success: false, message: 'Authentication required' });

    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (csv.trim() === '') throw new InvalidEntry('csv is required');

    const lines = csv.split(/\r?\n/).filter((line: string) => line.trim() !== '');
    if (lines.length < 2) {
      throw new InvalidEntry('The CSV needs a header row and at least one data row');
    }

    const header = lines[0].split(',').map((cell: string) => cell.trim().toLowerCase());
    const required = ['platenumber', 'casenumber', 'casetype'];
    const missing = required.filter((column) => !header.includes(column));
    if (missing.length > 0) {
      throw new InvalidEntry(`The CSV is missing required column(s): ${missing.join(', ')}`);
    }

    const imported: any[] = [];
    const rejected: Array<{ line: number; reason: string; row: string }> = [];

    for (let index = 1; index < lines.length; index += 1) {
      const cells = lines[index].split(',').map((cell: string) => cell.trim());
      const row: Record<string, string> = {};
      header.forEach((column: string, position: number) => {
        row[column] = cells[position] ?? '';
      });

      try {
        const entry = await prisma.watchlistEntry.create({
          data: buildEntry(
            {
              entityType: 'VEHICLE',
              plateNumber: row.platenumber,
              vehicleMakeModel: row.vehiclemakemodel || row.makemodel,
              color: row.color,
              caseNumber: row.casenumber,
              caseType: row.casetype,
              severity: row.severity || 'MEDIUM',
              expiresAt: row.expiresat,
              notes: row.notes,
            },
            issuedBy
          ),
          include: entryInclude,
        });
        imported.push(serialise(entry));
      } catch (error: any) {
        rejected.push({
          line: index + 1,
          reason: error instanceof InvalidEntry ? error.message : error.message,
          row: lines[index],
        });
      }
    }

    if (imported.length > 0) invalidateWatchlistCache();

    res.status(200).json({
      success: true,
      data: { imported: imported.length, rejected: rejected.length, entries: imported, rejections: rejected },
    });
  } catch (error: any) {
    fail(res, error, 'CSV import failed');
  }
};
