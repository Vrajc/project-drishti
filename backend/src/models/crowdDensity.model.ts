import mongoose, { Schema, Document } from 'mongoose';

export interface ICrowdDensity extends Document {
  eventId: string;
  zoneId: string;
  zoneName: string;
  peopleCount: number;
  densityPercentage: number;
  timestamp: Date;
  videoTimestamp: string; // Format: HH:MM:SS
  cameraId?: string;
  cameraName?: string;
  metadata?: {
    frameNumber?: number;
    confidence?: number;
    processingTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const crowdDensitySchema = new Schema<ICrowdDensity>(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      index: true,
    },
    zoneId: {
      type: String,
      required: [true, 'Zone ID is required'],
      index: true,
    },
    zoneName: {
      type: String,
      required: [true, 'Zone name is required'],
    },
    peopleCount: {
      type: Number,
      required: [true, 'People count is required'],
      min: 0,
    },
    densityPercentage: {
      type: Number,
      required: [true, 'Density percentage is required'],
      min: 0,
      max: 100,
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      index: true,
    },
    videoTimestamp: {
      type: String,
      required: [true, 'Video timestamp is required'],
    },
    cameraId: {
      type: String,
    },
    cameraName: {
      type: String,
    },
    metadata: {
      frameNumber: Number,
      confidence: Number,
      processingTime: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying
crowdDensitySchema.index({ eventId: 1, zoneId: 1, timestamp: -1 });
crowdDensitySchema.index({ eventId: 1, timestamp: -1 });

export const CrowdDensity = mongoose.model<ICrowdDensity>('CrowdDensity', crowdDensitySchema);
