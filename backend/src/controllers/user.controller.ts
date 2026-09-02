import { Response } from 'express';
import prisma from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

// The users API. Every route here used to answer with a fixed placeholder
// string, which is worse than not existing: it advertises a capability and
// returns something shaped like a response. Each one now runs a real query, and `password` is
// never selected, so it cannot leak through a spread.

const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  organization: true,
  phone: true,
  createdAt: true,
} as const;

function serialise(user: any) {
  return { ...user, role: String(user.role).toLowerCase() };
}

/**
 * True counts by role, straight from a GROUP BY.
 *
 * This replaces the admin dashboard's invented participant and admin totals.
 * Every role appears, including the ones with nobody in them, so a zero is
 * distinguishable from a role that does not exist.
 */
export const getUserStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [byRole, total, organizersWithEvents, eventCount, incidentCount] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count(),
      // Organizers who have actually created something, which is a different
      // number from "users with the organizer role" and worth showing as its own.
      prisma.event
        .findMany({ distinct: ['organizerId'], select: { organizerId: true } })
        .then((rows) => rows.length),
      prisma.event.count(),
      prisma.incident.count(),
    ]);

    const counts: Record<string, number> = {
      participant: 0,
      organizer: 0,
      admin: 0,
      police: 0,
    };
    for (const row of byRole) {
      counts[String(row.role).toLowerCase()] = row._count._all;
    }

    res.status(200).json({
      success: true,
      data: {
        total,
        byRole: counts,
        activeOrganizers: organizersWithEvents,
        eventCount,
        incidentCount,
      },
    });
  } catch (error: any) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch user statistics' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role.toUpperCase() : undefined;
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const take = Math.min(Math.max(Number(req.query.take) || 100, 1), 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: publicFields, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({ success: true, data: users.map(serialise), total, skip, take });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch users' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    // A user may read their own record; anyone else's is admin-only. Without
    // this, any authenticated user could enumerate the whole table by id.
    const isSelf = req.user?.userId === req.params.id;
    if (!isSelf && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: publicFields });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, data: serialise(user) });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const isSelf = req.user?.userId === req.params.id;
    if (!isSelf && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const { name, organization, phone } = req.body ?? {};

    // Deliberately narrow. Email is the login identity and role is an
    // authorisation decision; neither is editable through a profile form, and
    // silently ignoring an attempt to change them would be worse than refusing.
    if ('email' in (req.body ?? {}) || 'role' in (req.body ?? {}) || 'password' in (req.body ?? {})) {
      return res.status(400).json({
        success: false,
        message: 'Email, role and password cannot be changed here',
      });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'name cannot be empty' });
      }
      data.name = name.trim();
    }
    if (organization !== undefined) data.organization = organization?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: publicFields });
    res.status(200).json({ success: true, data: serialise(user) });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update user' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.userId === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account while signed in as it',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { organizedEvents: true } } },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Events cascade from their organizer. Deleting an organizer would take
    // their events, zones, cameras and incidents with them, so it is refused
    // rather than done quietly.
    if (user._count.organizedEvents > 0) {
      return res.status(409).json({
        success: false,
        message:
          `This user organises ${user._count.organizedEvents} event(s). Deleting them would ` +
          'delete those events and everything recorded against them. Reassign or delete the ' +
          'events first.',
      });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete user' });
  }
};

/**
 * Grants or revokes a privileged role. Administrators only.
 *
 * This is the legitimate path to an ADMIN or POLICE account, because public
 * registration refuses to create one. It is deliberately separate from
 * updateUser, which rejects role changes outright - a profile form and an
 * authorisation change should not share an endpoint.
 */
export const setUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const ROLES = ['PARTICIPANT', 'ORGANIZER', 'ADMIN', 'POLICE'] as const;
    const wanted = String(req.body?.role ?? '').toUpperCase();

    if (!ROLES.includes(wanted as (typeof ROLES)[number])) {
      return res.status(400).json({
        success: false,
        message: `role must be one of ${ROLES.join(', ').toLowerCase()}`,
      });
    }

    // An administrator demoting themselves could leave the deployment with no
    // administrator at all, so it is refused rather than discovered later.
    if (req.user?.userId === req.params.id && wanted !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own administrator role while signed in as it',
      });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: wanted as any },
      select: publicFields,
    });

    console.log(`Role change: ${user.email} is now ${wanted} (by ${req.user?.userId})`);
    res.status(200).json({ success: true, data: serialise(user) });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('Set user role error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to change the role' });
  }
};
