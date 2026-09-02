import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEvent, normaliseZones } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Users, MapPin, Upload, ArrowRight, Video, Truck, Phone, X } from 'lucide-react';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { createEvent } from '../services/event.service';
import { useToast } from '../components/Toast';

/**
 * A zone as this form collects it.
 *
 * maxCapacity is here because the server needs it and will not invent one. Zone
 * density is reported as a percentage of capacity, and every zone created from
 * this form used to be stored with a capacity of 100 that nobody entered - so
 * every percentage derived from it described a limit the organizer never set.
 */
interface ZoneDraft {
  name: string;
  maxCapacity: string;
}

interface DispatchUnit {
  id: string;
  name: string;
  type: string;
  contact: string;
  capacity: number;
  location: string;
}

const EventSetup: React.FC = () => {
  const navigate = useNavigate();
  const { addEvent } = useEvent();
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    date: '',
    time: '',
    crowdSize: 1000,
    zones: [] as ZoneDraft[],
    dispatchUnits: [] as DispatchUnit[],
    location: '',
    description: '',
    mapFile: null as File | null
  });
  const [newZone, setNewZone] = useState<ZoneDraft>({ name: '', maxCapacity: '' });
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [newDispatchUnit, setNewDispatchUnit] = useState<DispatchUnit>({
    id: '',
    name: '',
    type: 'ambulance',
    contact: '',
    capacity: 1,
    location: ''
  });

  const eventTypes = [
    'Concert', 'Festival', 'Conference', 'Sports Event', 'Exhibition', 'Parade', 'Political Rally', 'Other'
  ];

  const dispatchUnitTypes = [
    'ambulance', 'fire-truck', 'police', 'medical-team', 'security-team'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.email) {
      toast.error('You are not signed in', 'Sign in again and retry.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const eventData = {
        ...formData,
        // Capacity is collected as text and sent as a number: the API stores it
        // as an Int and reports density against it.
        zones: formData.zones.map((zone) => ({
          name: zone.name,
          maxCapacity: Number(zone.maxCapacity),
        })),
        organizerId: user.id || '',
        organizerEmail: user.email,
        organizerName: user.name || '',
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'
      };

      // Create event via API (saves to database)
      const response = await createEvent(eventData);
      
      if (response.success) {
        // Also add to local context for immediate UI update
        // The server is the authority on what a zone is: it returns Zone rows with ids,
        // coordinates and capacities. Seed the context from the response rather than from
        // the plain strings this form collected, so the shape matches what a page reload
        // will produce.
        addEvent({
          id: response.data._id,
          ...eventData,
          zones: normaliseZones(response.data.zones),
          // A new event borrows no cameras yet; they are assigned from the
          // registry afterwards, and the dashboard reads them from the server.
          cameras: response.data.cameras ?? [],
          mapFile: response.data.mapFile, // Map file URL
          registeredUsers: []
        });
        
        toast.success('Event created', `${eventData.name} is ready. Assign its cameras next.`);
        navigate('/organizer-dashboard');
      }
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('The event was not created', error.message || 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addZone = () => {
    const name = newZone.name.trim();
    const capacity = Number(newZone.maxCapacity);

    if (!name) {
      setZoneError('A zone needs a name');
      return;
    }
    if (formData.zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      setZoneError(`"${name}" is already on the list`);
      return;
    }
    // The server rejects a zone without a capacity rather than defaulting one,
    // so the form asks for it here instead of failing on submit.
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setZoneError('A zone needs a maximum capacity above zero: density is a percentage of it');
      return;
    }

    setFormData({ ...formData, zones: [...formData.zones, { name, maxCapacity: String(Math.round(capacity)) }] });
    setNewZone({ name: '', maxCapacity: '' });
    setZoneError(null);
  };

  const removeZone = (name: string) => {
    setFormData({ ...formData, zones: formData.zones.filter((z) => z.name !== name) });
  };

  const addDispatchUnit = () => {
    if (newDispatchUnit.name.trim() && newDispatchUnit.contact.trim()) {
      const unit = {
        ...newDispatchUnit,
        id: Math.random().toString(36).substr(2, 9)
      };
      setFormData({ ...formData, dispatchUnits: [...formData.dispatchUnits, unit] });
      setNewDispatchUnit({ id: '', name: '', type: 'ambulance', contact: '', capacity: 1, location: '' });
    }
  };

  const removeDispatchUnit = (unitId: string) => {
    setFormData({ ...formData, dispatchUnits: formData.dispatchUnits.filter(u => u.id !== unitId) });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, mapFile: file });
    }
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Event Setup
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg">
              Configure your event details to enable AI-powered safety features
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-light rounded-2xl p-4 sm:p-6 lg:p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    placeholder="Enter event name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    Event Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white focus:border-ai-white focus:outline-none transition-colors"
                    required
                  >
                    <option value="">Select event type</option>
                    {eventTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white focus:border-ai-white focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white focus:border-ai-white focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Location and Crowd Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    placeholder="Enter event location"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    Expected Crowd Size
                  </label>
                  <input
                    type="number"
                    value={formData.crowdSize}
                    onChange={(e) => setFormData({ ...formData, crowdSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white focus:border-ai-white focus:outline-none transition-colors"
                    min="50"
                    max="100000"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                  Event Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                  placeholder="Provide a brief description of your event"
                  rows={4}
                  required
                />
              </div>

              {/* Zones */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                  Event Zones
                </label>
                <p className="text-xs text-ai-gray-500 mb-3">
                  Capacity is what crowd density is reported against: a zone counted at 40 people
                  against a capacity of 200 reads as 20% full. Counting geometry is drawn on a
                  camera later - this is the layout and the limit.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={newZone.name}
                    onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                    className="flex-1 min-w-0 px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    placeholder="Zone name (e.g., Main Stage)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addZone())}
                  />
                  <input
                    type="number"
                    min={1}
                    value={newZone.maxCapacity}
                    onChange={(e) => setNewZone({ ...newZone, maxCapacity: e.target.value })}
                    className="w-full sm:w-44 shrink-0 px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    placeholder="Max capacity"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addZone())}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={addZone}
                    className="shrink-0 px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                  >
                    Add
                  </motion.button>
                </div>

                {zoneError && (
                  <p className="text-sm text-red-400 mb-3 break-anywhere">{zoneError}</p>
                )}

                <div className="space-y-2">
                  {formData.zones.map((zone) => (
                    <motion.div
                      key={zone.name}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 bg-ai-gray-800/40 border border-ai-gray-800 rounded-xl"
                    >
                      <span className="text-ai-gray-200 truncate">{zone.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-ai-gray-400">
                          {Number(zone.maxCapacity).toLocaleString()} capacity
                        </span>
                        <button
                          type="button"
                          onClick={() => removeZone(zone.name)}
                          aria-label={`Remove ${zone.name}`}
                          className="icon-btn w-6 h-6 leading-none flex items-center justify-center rounded-full text-ai-gray-400 hover:text-white hover:bg-ai-gray-700/50 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Cameras come from the registry, not from this form.
                  This block used to collect a name, a location, an IP and an
                  RTSP URL and create Camera rows from them. Nothing validated
                  any of it, so an event could be set up with cameras the health
                  poller could never reach and no stream could ever be served
                  from - registry rows that only looked like an estate. A
                  camera is assigned to an event after it is created. */}
              <div className="rounded-xl border border-ai-gray-800 bg-ai-gray-800/30 p-4">
                <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                  <Video className="w-4 h-4 inline mr-2" />
                  Cameras
                </label>
                <p className="text-sm text-ai-gray-400">
                  Cameras are assigned from the surveillance registry once the event exists, so
                  every camera on an event is a real registered camera the health poller is
                  probing. Create the event, then assign its cameras from the event dashboard.
                </p>
              </div>

              {/* Emergency Dispatch Units */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-4">
                  <Truck className="w-4 h-4 inline mr-2" />
                  Emergency Dispatch Units
                </label>
                <div className="space-y-3 mb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newDispatchUnit.name}
                      onChange={(e) => setNewDispatchUnit({ ...newDispatchUnit, name: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Unit name (e.g., Ambulance Unit 1)"
                    />
                    <select
                      value={newDispatchUnit.type}
                      onChange={(e) => setNewDispatchUnit({ ...newDispatchUnit, type: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white focus:border-ai-white focus:outline-none transition-colors"
                    >
                      {dispatchUnitTypes.map(type => (
                        <option key={type} value={type}>
                          {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
                    <input
                      type="tel"
                      value={newDispatchUnit.contact}
                      onChange={(e) => setNewDispatchUnit({ ...newDispatchUnit, contact: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Contact number"
                    />
                    <input
                      type="number"
                      value={newDispatchUnit.capacity}
                      onChange={(e) => setNewDispatchUnit({ ...newDispatchUnit, capacity: parseInt(e.target.value) || 1 })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Capacity"
                      min="1"
                    />
                    <input
                      type="text"
                      value={newDispatchUnit.location}
                      onChange={(e) => setNewDispatchUnit({ ...newDispatchUnit, location: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Base location"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={addDispatchUnit}
                    className="w-full px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                  >
                    Add Dispatch Unit
                  </motion.button>
                </div>
                <div className="space-y-2">
                  {formData.dispatchUnits.map(unit => (
                    <motion.div
                      key={unit.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-ai-gray-800/30 border border-ai-gray-800 rounded-xl"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Truck className="w-4 h-4 text-ai-gray-400 shrink-0" />
                            <h4 className="font-medium text-white break-anywhere">{unit.name}</h4>
                            <span className="px-2 py-0.5 bg-ai-gray-700 text-ai-gray-300 text-xs rounded-full">
                              {unit.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-ai-gray-400 space-y-1 break-anywhere">
                            <p className="flex items-center gap-2">
                              <Phone className="w-3 h-3 shrink-0" /> {unit.contact}
                            </p>
                            <p className="flex items-center gap-2">
                              <Users className="w-3 h-3" /> Capacity: {unit.capacity}
                            </p>
                            {unit.location && <p>📍 Base: {unit.location}</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDispatchUnit(unit.id)}
                          className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Map Upload */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Event Map (Optional)
                </label>
                <div className="border-2 border-dashed border-ai-gray-800 rounded-xl p-4 sm:p-6 text-center hover:border-ai-white transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="map-upload"
                  />
                  <label htmlFor="map-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-ai-gray-400" />
                    <p className="text-sm sm:text-base text-ai-gray-400 break-anywhere">
                      {formData.mapFile ? formData.mapFile.name : 'Upload venue map or floor plan'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-stretch sm:justify-end">
                <motion.button
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto justify-center px-6 sm:px-8 py-3 rounded-xl transition-colors flex items-center gap-2 ${
                    isSubmitting 
                      ? 'bg-ai-gray-600 text-ai-gray-400 cursor-not-allowed' 
                      : 'bg-ai-white text-ai-black hover:bg-ai-gray-300'
                  }`}
                >
                  {isSubmitting ? 'Creating Event...' : 'Start Safety Planning'} 
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default EventSetup;