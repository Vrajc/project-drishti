import { Request, Response } from 'express';
import crowdAnalysisService from '../services/crowdAnalysis.service.js';
import prisma from '../lib/prisma.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const uploadVideo = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

/**
 * Upload and process video for crowd analysis
 */
export const processVideoFootage = async (req: Request, res: Response) => {
  try {
    const { eventId, cameraId, cameraName, sampleInterval } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file uploaded'
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // This endpoint used to accept the upload, discard it, and write randomly
    // generated density rows instead - so an organizer who uploaded real
    // footage was shown numbers that had nothing to do with it. It now runs the
    // analyzer on the file that was actually uploaded.
    const videoPath = req.file.path;
    const interval = parseInt(sampleInterval) || 15;

    crowdAnalysisService
      .processAndSaveVideo(videoPath, eventId, cameraId, cameraName, interval)
      .then((result) => {
        console.log(
          `Archived footage analysed for event ${eventId}: ${result.recordCount} density record(s)`
        );
      })
      .catch((error) => {
        // The failure is surfaced through the density endpoints staying empty
        // rather than being papered over with substitute rows.
        console.error(`Archived footage analysis failed for event ${eventId}:`, error.message);
      })
      .finally(() => {
        // The uploaded file is only needed for the duration of the analysis.
        fs.unlink(videoPath, () => undefined);
      });

    // Analysis runs past the lifetime of this request, so the response says
    // what was accepted, not what was found.
    res.status(202).json({
      success: true,
      message:
        'Video accepted. Analysis is running; density readings appear as frames are processed.',
      data: {
        filename: req.file.filename,
        eventId,
        sampleIntervalSeconds: interval
      }
    });
  } catch (error: any) {
    console.error('Error in processVideoFootage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process video',
      error: error.message
    });
  }
};

/**
 * Get crowd density data for an event
 */
export const getCrowdDensity = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { zoneId, startTime, endTime } = req.query;

    const startDate = startTime ? new Date(startTime as string) : undefined;
    const endDate = endTime ? new Date(endTime as string) : undefined;

    const data = await crowdAnalysisService.getCrowdDensityData(
      eventId,
      zoneId as string,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data,
      count: data.length
    });
  } catch (error: any) {
    console.error('Error in getCrowdDensity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crowd density data',
      error: error.message
    });
  }
};

/**
 * Get latest crowd density for each zone
 */
export const getLatestDensity = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const data = await crowdAnalysisService.getLatestDensityByZone(eventId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in getLatestDensity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest density data',
      error: error.message
    });
  }
};

/**
 * Get statistics for a specific zone
 */
export const getZoneStatistics = async (req: Request, res: Response) => {
  try {
    const { eventId, zoneId } = req.params;
    const { startTime, endTime } = req.query;

    const startDate = startTime ? new Date(startTime as string) : undefined;
    const endDate = endTime ? new Date(endTime as string) : undefined;

    const stats = await crowdAnalysisService.getZoneStatistics(
      eventId,
      zoneId,
      startDate,
      endDate
    );

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this zone'
      });
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error in getZoneStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zone statistics',
      error: error.message
    });
  }
};

/**
 * Get heatmap data for crowd density visualization
 */
export const getHeatmapData = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { startTime, endTime } = req.query;

    const startDate = startTime ? new Date(startTime as string) : undefined;
    const endDate = endTime ? new Date(endTime as string) : undefined;

    const heatmapData = await crowdAnalysisService.getHeatmapData(
      eventId,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data: heatmapData
    });
  } catch (error: any) {
    console.error('Error in getHeatmapData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heatmap data',
      error: error.message
    });
  }
};

/**
 * Get all zones for an event
 */
export const getEventZones = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { zones: true },
    });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        zones: event.zones,
        eventName: event.name
      }
    });
  } catch (error: any) {
    console.error('Error in getEventZones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event zones',
      error: error.message
    });
  }
};

