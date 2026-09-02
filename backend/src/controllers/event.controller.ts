import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';

const eventInclude = {
  zones: true,
  cameras: true,
  dispatchUnits: true,
  registrations: { select: { userId: true } },
};

/** A zone the request cannot be honoured for. Surfaces as a 400, not a default. */
class InvalidZone extends Error {}

/**
 * Zone rows from whatever the organizer's form sent.
 *
 * maxCapacity has no default. Density is reported as a percentage of it, so a
 * capacity nobody entered makes every percentage derived from it fiction - and
 * it used to default to 100 for every zone, because the setup form collected
 * zone names and nothing else.
 *
 * Coordinates stay empty here and that is correct: a counting polygon is drawn
 * on a camera's frame, not on the event map, so an event zone is the
 * organizer's layout and capacity, not a region a detector can count inside.
 */
const zoneRows = (zones: any[]) =>
  zones.map((zone: any, i: number) => {
    const fromString = typeof zone === 'string';
    const name = (fromString ? zone : String(zone?.name ?? '')).trim();
    if (!name) throw new InvalidZone(`Zone ${i + 1} needs a name`);

    const capacity = Number(fromString ? NaN : zone?.maxCapacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new InvalidZone(
        `Zone "${name}" needs a maximum capacity above zero: density is reported as a percentage of it`
      );
    }

    return {
      zoneId: (fromString ? '' : zone?.zoneId || zone?.id) || `zone-${i}`,
      name,
      coordinates: (fromString ? [] : zone?.coordinates) || [],
      maxCapacity: Math.round(capacity),
      color: fromString ? undefined : zone?.color,
    };
  });

// Helper to format event response to match frontend expectations
function formatEvent(event: any) {
  const { registrations, ...rest } = event;
  return {
    ...rest,
    _id: event.id,
    registeredUsers: registrations?.map((r: any) => r.userId) || [],
  };
}

// Create a new event
export const createEvent = async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      date,
      time,
      endDate,
      endTime,
      crowdSize,
      zones,
      dispatchUnits,
      location,
      description,
      mapFileBase64,
      organizerId,
      organizerEmail,
      organizerName,
      image
    } = req.body;

    // Store map file base64 directly if provided
    let mapFileUrl = '';
    if (mapFileBase64) {
      mapFileUrl = mapFileBase64;
    }

    // Create the event with nested relations
    const event = await prisma.event.create({
      data: {
        name,
        type,
        date,
        time,
        // Blank rather than absent means the form did not collect one; either
        // way it is stored as null and read as "not recorded".
        endDate: endDate || null,
        endTime: endTime || null,
        crowdSize: Number(crowdSize),
        location,
        description,
        mapFile: mapFileUrl || undefined,
        organizerId,
        organizerEmail,
        organizerName,
        image,
        zones: { create: zoneRows(zones || []) },
        // Cameras are deliberately not created here. An event borrows cameras
        // from the registry - `PUT /api/surveillance/cameras/:id/assignment`
        // sets Camera.eventId - and the rows this block used to write had an
        // empty rtspUrl and ipAddress, so the health poller could never reach
        // them and no stream could ever be served from them. Anything sent
        // under `cameras` is ignored; the response carries the real assignment.
        dispatchUnits: {
          create: (dispatchUnits || []).map((d: any, i: number) => ({
            unitId: d.id || `unit-${i}`,
            name: d.name || `Unit ${i + 1}`,
            type: d.type || '',
            contact: d.contact || '',
            capacity: Number(d.capacity) || 0,
            location: d.location || '',
          })),
        },
      },
      include: eventInclude,
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: formatEvent(event),
    });
  } catch (error: any) {
    if (error instanceof InvalidZone) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create event',
    });
  }
};

// Get all events
export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: eventInclude,
    });

    res.status(200).json({
      success: true,
      data: events.map(formatEvent),
    });
  } catch (error: any) {
    console.error('Get all events error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch events',
    });
  }
};

// Get events by organizer email
export const getEventsByOrganizer = async (req: Request, res: Response) => {
  try {
    const { organizerEmail } = req.params;

    const events = await prisma.event.findMany({
      where: { organizerEmail },
      orderBy: { createdAt: 'desc' },
      include: eventInclude,
    });

    res.status(200).json({
      success: true,
      data: events.map(formatEvent),
    });
  } catch (error: any) {
    console.error('Get events by organizer error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch events',
    });
  }
};

// Get single event by ID
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.status(200).json({
      success: true,
      data: formatEvent(event),
    });
  } catch (error: any) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch event',
    });
  }
};

// Update event
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { zones, cameras, dispatchUnits, mapFileBase64, ...updateData } = req.body;

    // If there's a new map file, store it directly
    if (mapFileBase64) {
      updateData.mapFile = mapFileBase64;
    }

    if (updateData.crowdSize) updateData.crowdSize = Number(updateData.crowdSize);

    // Update event and replace nested relations if provided
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...updateData,
        ...(zones ? { zones: { deleteMany: {}, create: zoneRows(zones) } } : {}),
        // `cameras` is ignored on update as well, and here it was destructive:
        // deleteMany deleted the registry rows themselves, taking their zones,
        // health history and stream configuration with them, because an event
        // editing its own layout looked like ownership. Assignment is a
        // foreign key on the camera, changed through the surveillance API.
        ...(dispatchUnits ? {
          dispatchUnits: {
            deleteMany: {},
            create: dispatchUnits.map((d: any, i: number) => ({
              unitId: d.id || `unit-${i}`,
              name: d.name || `Unit ${i + 1}`,
              type: d.type || '',
              contact: d.contact || '',
              capacity: Number(d.capacity) || 0,
              location: d.location || '',
            })),
          },
        } : {}),
      },
      include: eventInclude,
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: formatEvent(event),
    });
  } catch (error: any) {
    if (error instanceof InvalidZone) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Update event error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update event',
    });
  }
};

// Delete event
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.event.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete event',
    });
  }
};

// Register user for event
export const registerForEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { registrations: { select: { userId: true } } },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check if user is already registered
    if (event.registrations.some(r => r.userId === userId)) {
      return res.status(400).json({
        success: false,
        message: 'User already registered for this event',
      });
    }

    // Add registration
    await prisma.eventRegistration.create({
      data: { userId, eventId: id },
    });

    const updatedEvent = await prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });

    res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      data: formatEvent(updatedEvent),
    });
  } catch (error: any) {
    console.error('Register for event error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register for event',
    });
  }
};
