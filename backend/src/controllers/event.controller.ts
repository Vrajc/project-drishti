import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import cloudinary from '../config/cloudinary';

const eventInclude = {
  zones: true,
  cameras: true,
  dispatchUnits: true,
  registrations: { select: { userId: true } },
};

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
      crowdSize,
      zones,
      cameras,
      dispatchUnits,
      location,
      description,
      mapFileBase64,
      organizerId,
      organizerEmail,
      organizerName,
      image
    } = req.body;

    // Upload map file to Cloudinary if provided
    let mapFileUrl = '';
    if (mapFileBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(mapFileBase64, {
          folder: 'event-maps',
          resource_type: 'auto',
        });
        mapFileUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload map file to Cloudinary',
        });
      }
    }

    // Create the event with nested relations
    const event = await prisma.event.create({
      data: {
        name,
        type,
        date,
        time,
        crowdSize: Number(crowdSize),
        location,
        description,
        mapFile: mapFileUrl || undefined,
        organizerId,
        organizerEmail,
        organizerName,
        image,
        zones: {
          create: (zones || []).map((z: any, i: number) => ({
            zoneId: z.id || `zone-${i}`,
            name: typeof z === 'string' ? z : z.name,
            coordinates: typeof z === 'string' ? [] : (z.coordinates || []),
            maxCapacity: z.maxCapacity || 100,
            color: z.color,
          })),
        },
        cameras: {
          create: (cameras || []).map((c: any, i: number) => ({
            cameraId: c.id || `camera-${i}`,
            name: c.name || `Camera ${i + 1}`,
            location: c.location || '',
            ipAddress: c.ipAddress || '',
            rtspUrl: c.rtspUrl || '',
          })),
        },
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

    // If there's a new map file, upload it to Cloudinary
    if (mapFileBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(mapFileBase64, {
          folder: 'event-maps',
          resource_type: 'auto',
        });
        updateData.mapFile = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload map file to Cloudinary',
        });
      }
    }

    if (updateData.crowdSize) updateData.crowdSize = Number(updateData.crowdSize);

    // Update event and replace nested relations if provided
    const event = await prisma.event.update({
      where: { id },
      data: {
        ...updateData,
        ...(zones ? {
          zones: {
            deleteMany: {},
            create: zones.map((z: any, i: number) => ({
              zoneId: z.id || `zone-${i}`,
              name: typeof z === 'string' ? z : z.name,
              coordinates: typeof z === 'string' ? [] : (z.coordinates || []),
              maxCapacity: z.maxCapacity || 100,
              color: z.color,
            })),
          },
        } : {}),
        ...(cameras ? {
          cameras: {
            deleteMany: {},
            create: cameras.map((c: any, i: number) => ({
              cameraId: c.id || `camera-${i}`,
              name: c.name || `Camera ${i + 1}`,
              location: c.location || '',
              ipAddress: c.ipAddress || '',
              rtspUrl: c.rtspUrl || '',
            })),
          },
        } : {}),
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
