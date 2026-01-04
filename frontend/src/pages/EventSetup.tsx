import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Users, MapPin, Upload, ArrowRight, Video, Truck, Phone, X } from 'lucide-react';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { createEvent } from '../services/event.service';

interface Camera {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    date: '',
    time: '',
    crowdSize: 1000,
    zones: [] as string[],
    cameras: [] as Camera[],
    dispatchUnits: [] as DispatchUnit[],
    location: '',
    description: '',
    mapFile: null as File | null
  });
  const [newZone, setNewZone] = useState('');
  const [newCamera, setNewCamera] = useState<Camera>({
    id: '',
    name: '',
    location: '',
    ipAddress: '',
    rtspUrl: ''
  });
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
      alert('User email not found. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const eventData = {
        ...formData,
        organizerId: user.id || '',
        organizerEmail: user.email,
        organizerName: user.name || '',
        image: 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'
      };

      // Create event via API (saves to database and uploads map to Cloudinary)
      const response = await createEvent(eventData);
      
      if (response.success) {
        // Also add to local context for immediate UI update
        addEvent({
          id: response.data._id,
          ...eventData,
          mapFile: response.data.mapFile, // Use Cloudinary URL
          registeredUsers: []
        });
        
        alert('Event created successfully!');
        navigate('/organizer-dashboard');
      }
    } catch (error: any) {
      console.error('Error creating event:', error);
      alert(error.message || 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addZone = () => {
    if (newZone.trim() && !formData.zones.includes(newZone.trim())) {
      setFormData({ ...formData, zones: [...formData.zones, newZone.trim()] });
      setNewZone('');
    }
  };

  const removeZone = (zone: string) => {
    setFormData({ ...formData, zones: formData.zones.filter(z => z !== zone) });
  };

  const addCamera = () => {
    if (newCamera.name.trim() && newCamera.location.trim()) {
      const camera = {
        ...newCamera,
        id: Math.random().toString(36).substr(2, 9)
      };
      setFormData({ ...formData, cameras: [...formData.cameras, camera] });
      setNewCamera({ id: '', name: '', location: '', ipAddress: '', rtspUrl: '' });
    }
  };

  const removeCamera = (cameraId: string) => {
    setFormData({ ...formData, cameras: formData.cameras.filter(c => c.id !== cameraId) });
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
      
      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              Event Setup
            </h1>
            <p className="text-ai-gray-400 text-lg">
              Configure your event details to enable AI-powered safety features
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-light rounded-2xl p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newZone}
                    onChange={(e) => setNewZone(e.target.value)}
                    className="flex-1 px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                    placeholder="Add zone (e.g., Main Stage, VIP Area, Food Court)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addZone())}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={addZone}
                    className="px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                  >
                    Add
                  </motion.button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.zones.map(zone => (
                    <motion.span
                      key={zone}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-1 bg-ai-gray-600/20 text-ai-gray-300 rounded-full text-sm flex items-center gap-2"
                    >
                      {zone}
                      <button
                        type="button"
                        onClick={() => removeZone(zone)}
                        className="text-ai-gray-400 hover:text-white"
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Camera Inputs */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-4">
                  <Video className="w-4 h-4 inline mr-2" />
                  Camera Inputs
                </label>
                <div className="space-y-3 mb-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCamera.name}
                      onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Camera name (e.g., Main Gate Camera)"
                    />
                    <input
                      type="text"
                      value={newCamera.location}
                      onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="Location (e.g., North Entrance)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCamera.ipAddress}
                      onChange={(e) => setNewCamera({ ...newCamera, ipAddress: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="IP Address (e.g., 192.168.1.100)"
                    />
                    <input
                      type="text"
                      value={newCamera.rtspUrl}
                      onChange={(e) => setNewCamera({ ...newCamera, rtspUrl: e.target.value })}
                      className="px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-400 focus:border-ai-white focus:outline-none transition-colors"
                      placeholder="RTSP URL (optional)"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={addCamera}
                    className="w-full px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                  >
                    Add Camera
                  </motion.button>
                </div>
                <div className="space-y-2">
                  {formData.cameras.map(camera => (
                    <motion.div
                      key={camera.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-ai-gray-800/30 border border-ai-gray-800 rounded-xl"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Video className="w-4 h-4 text-ai-gray-400" />
                            <h4 className="font-medium text-white">{camera.name}</h4>
                          </div>
                          <div className="text-sm text-ai-gray-400 space-y-1">
                            <p>📍 Location: {camera.location}</p>
                            {camera.ipAddress && <p>🌐 IP: {camera.ipAddress}</p>}
                            {camera.rtspUrl && <p>🔗 RTSP: {camera.rtspUrl}</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCamera(camera.id)}
                          className="text-ai-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Emergency Dispatch Units */}
              <div>
                <label className="block text-sm font-medium text-ai-gray-300 mb-4">
                  <Truck className="w-4 h-4 inline mr-2" />
                  Emergency Dispatch Units
                </label>
                <div className="space-y-3 mb-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Truck className="w-4 h-4 text-ai-gray-400" />
                            <h4 className="font-medium text-white">{unit.name}</h4>
                            <span className="px-2 py-0.5 bg-ai-gray-700 text-ai-gray-300 text-xs rounded-full">
                              {unit.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </span>
                          </div>
                          <div className="text-sm text-ai-gray-400 space-y-1">
                            <p className="flex items-center gap-2">
                              <Phone className="w-3 h-3" /> {unit.contact}
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
                          className="text-ai-gray-400 hover:text-red-500 transition-colors"
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
                <div className="border-2 border-dashed border-ai-gray-800 rounded-xl p-6 text-center hover:border-ai-white transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="map-upload"
                  />
                  <label htmlFor="map-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-ai-gray-400" />
                    <p className="text-ai-gray-400">
                      {formData.mapFile ? formData.mapFile.name : 'Upload venue map or floor plan'}
                    </p>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-8 py-3 rounded-xl transition-colors flex items-center gap-2 ${
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