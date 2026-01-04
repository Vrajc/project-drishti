import { Request, Response } from 'express';
import { Event } from '../models/event.model';
import cloudinary from '../config/cloudinary';

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
      mapFileBase64, // Base64 encoded file from frontend
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

    // Create the event
    const event = await Event.create({
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
      mapFile: mapFileUrl,
      organizerId,
      organizerEmail,
      organizerName,
      registeredUsers: [],
      image,
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event,
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
    const events = await Event.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: events,
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
    
    const events = await Event.find({ organizerEmail }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: events,
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
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: event,
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
    const updateData = req.body;
    
    // If there's a new map file, upload it to Cloudinary
    if (updateData.mapFileBase64) {
      try {
        const uploadResult = await cloudinary.uploader.upload(updateData.mapFileBase64, {
          folder: 'event-maps',
          resource_type: 'auto',
        });
        updateData.mapFile = uploadResult.secure_url;
        delete updateData.mapFileBase64;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload map file to Cloudinary',
        });
      }
    }
    
    const event = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event,
    });
  } catch (error: any) {
    console.error('Update event error:', error);
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
    
    const event = await Event.findByIdAndDelete(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete event error:', error);
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
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }
    
    // Check if user is already registered
    if (event.registeredUsers.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User already registered for this event',
      });
    }
    
    // Add user to registered users
    event.registeredUsers.push(userId);
    await event.save();
    
    res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      data: event,
    });
  } catch (error: any) {
    console.error('Register for event error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register for event',
    });
  }
};
