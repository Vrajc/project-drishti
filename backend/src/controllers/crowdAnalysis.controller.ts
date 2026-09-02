import { Request, Response } from 'express';
import crowdAnalysisService from '../services/crowdAnalysis.service.js';
import prisma from '../lib/prisma.js';
/**
 * Crowd density readings for an event.
 *
 * There is no upload endpoint here any more. This module used to accept a video
 * file, run a Python analyser over it and write CrowdDensity rows from the
 * result - so an event's "crowd flow" was whatever footage somebody happened to
 * upload, after the fact. Density now comes from the cameras assigned to the
 * event: the detector counts them live and the detection consumer writes the
 * rows. These handlers only read what was recorded.
 */

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

