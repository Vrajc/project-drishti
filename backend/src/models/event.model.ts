import mongoose, { Schema, Document } from 'mongoose';

export interface ICamera {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;
}

export interface IZone {
  id: string;
  name: string;
  coordinates: Array<{ x: number; y: number }>;
  maxCapacity: number;
  color?: string;
}

export interface IDispatchUnit {
  id: string;
  name: string;
  type: string;
  contact: string;
  capacity: number;
  location: string;
}

export interface IEvent extends Document {
  name: string;
  type: string;
  date: string;
  time: string;
  crowdSize: number;
  zones: (string | IZone)[];
  cameras: ICamera[];
  dispatchUnits: IDispatchUnit[];
  location: string;
  description?: string;
  mapFile?: string; // Cloudinary URL
  organizerId: string;
  organizerEmail: string;
  organizerName: string;
  registeredUsers: string[];
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cameraSchema = new Schema({
  id: String,
  name: String,
  location: String,
  ipAddress: String,
  rtspUrl: String
}, { _id: false });

const zoneSchema = new Schema({
  id: String,
  name: String,
  coordinates: [{
    x: Number,
    y: Number
  }],
  maxCapacity: Number,
  color: String
}, { _id: false });

const dispatchUnitSchema = new Schema({
  id: String,
  name: String,
  type: String,
  contact: String,
  capacity: Number,
  location: String
}, { _id: false });

const eventSchema = new Schema<IEvent>(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Event type is required'],
    },
    date: {
      type: String,
      required: [true, 'Event date is required'],
    },
    time: {
      type: String,
      required: [true, 'Event time is required'],
    },
    crowdSize: {
      type: Number,
      required: [true, 'Crowd size is required'],
      min: 1,
    },
    zones: [{
      type: Schema.Types.Mixed  // Allow both string and zone object
    }],
    cameras: [cameraSchema],
    dispatchUnits: [dispatchUnitSchema],
    location: {
      type: String,
      required: [true, 'Location is required'],
    },
    description: String,
    mapFile: String, // Cloudinary URL
    organizerId: {
      type: String,
      required: true,
    },
    organizerEmail: {
      type: String,
      required: true,
    },
    organizerName: {
      type: String,
      required: true,
    },
    registeredUsers: [{
      type: String
    }],
    image: String,
  },
  {
    timestamps: true,
  }
);

export const Event = mongoose.model<IEvent>('Event', eventSchema);
