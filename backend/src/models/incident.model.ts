import mongoose, { Schema, Document } from 'mongoose';

export interface IIncident extends Document {
  eventId: string;
  type: 'medical' | 'security' | 'lost_found' | 'general';
  description: string;
  location: string;
  timestamp: Date;
  reporter: string;
  reporterEmail?: string;
  status: 'open' | 'investigating' | 'resolved';
  responseTime?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema: Schema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['medical', 'security', 'lost_found', 'general'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    reporter: {
      type: String,
      required: true,
    },
    reporterEmail: {
      type: String,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved'],
      default: 'open',
    },
    responseTime: {
      type: Number,
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
IncidentSchema.index({ eventId: 1, status: 1 });
IncidentSchema.index({ eventId: 1, timestamp: -1 });

export default mongoose.model<IIncident>('Incident', IncidentSchema);
