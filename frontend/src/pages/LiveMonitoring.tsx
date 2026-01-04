import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, AlertTriangle, Users, Shield, Camera, Upload, MessageSquare, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import { useNavigate } from 'react-router-dom';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { analyzeMonitoring } from '../services/ai.service';
import { incidentService, Incident as IncidentType } from '../services/incident.service';
import crowdAnalysisService from '../services/crowdAnalysis.service';

interface Incident {
  _id?: string;
  id?: string;
  type: 'medical' | 'security' | 'lost_found' | 'general';
  description: string;
  location: string;
  timestamp: Date;
  reporter: string;
  reporterEmail?: string;
  status: 'open' | 'investigating' | 'resolved';
  responseTime?: number;
  resolvedAt?: Date;
}

const LiveMonitoring: React.FC = () => {
  const { user } = useAuth();
  const { getUserRegisteredEvents, getEventsByOrganizer } = useEvent();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [newIncident, setNewIncident] = useState({
    type: 'general' as const,
    description: '',
    location: ''
  });
  const [lostFoundImage, setLostFoundImage] = useState<File | null>(null);
  const [crowdDensity, setCrowdDensity] = useState<any[]>([]);
  const [avgCrowdDensity, setAvgCrowdDensity] = useState<number>(0);

  // Helper function to check if event is live
  const isEventLive = (date: string, time: string): boolean => {
    const now = new Date();
    
    // Parse the event date and time
    const eventDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    
    // Assume event duration is 8 hours (can be made configurable)
    const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
    
    // Check if current time is within event timeframe
    return now >= eventDate && now <= eventEndTime;
  };

  // Get events based on user role
  const userEvents = user?.role === 'organizer' 
    ? getEventsByOrganizer(user?.email || '')
    : getUserRegisteredEvents(user?.id || '');
  
  // Find live event
  const liveEvent = userEvents.find(event => isEventLive(event.date, event.time));

  // Debug logging
  useEffect(() => {
    console.log('=== LiveMonitoring Debug ===');
    console.log('User Role:', user?.role);
    console.log('User Events:', userEvents);
    console.log('Live Event:', liveEvent);
    console.log('Live Event ID:', liveEvent?.id);
    
    // Show all incident keys in localStorage
    console.log('All incident keys in localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('drishti_incidents_')) {
        const data = localStorage.getItem(key);
        console.log(`  ${key}:`, data ? JSON.parse(data).length + ' incidents' : 'empty');
      }
    }
    
    if (liveEvent) {
      console.log('Checking localStorage key:', `drishti_incidents_${liveEvent.id}`);
      const stored = localStorage.getItem(`drishti_incidents_${liveEvent.id}`);
      console.log('Stored incidents:', stored);
    }
    console.log('===========================');
  }, [user?.role, userEvents.length, liveEvent?.id]);

  // Calculate real stats from event data
  const stats = {
    eventName: liveEvent?.name || 'No Live Event',
    safetyStatus: liveEvent ? 'OPTIMAL' : 'NO DATA',
    activeIncidents: incidents.filter(i => i.status !== 'resolved').length,
    crowdLevel: avgCrowdDensity > 0 ? avgCrowdDensity.toString() : '0',
    emergencyUnits: liveEvent?.dispatchUnits?.length || 0,
    responseTime: liveEvent ? 3.2 : 0,
    cameras: liveEvent?.cameras?.length || 0,
    zones: liveEvent?.zones?.length || 0,
    safetyScore: liveEvent ? Math.max(0, 100 - (incidents.filter(i => i.status !== 'resolved').length * 5)) : 0,
    crowdDensity: avgCrowdDensity
  };

  const incidentTypes = {
    medical: { label: 'Medical Emergency', color: 'bg-ai-white/20', icon: '🏥' },
    security: { label: 'Security Issue', color: 'bg-ai-gray-600/20', icon: '⚠️' },
    lost_found: { label: 'Lost & Found', color: 'bg-ai-gray-600/20', icon: '📱' },
    general: { label: 'General Incident', color: 'bg-ai-gray-600/20', icon: '📋' }
  };

  const zones = liveEvent?.zones || ['Main Area'];

  // Load incidents from MongoDB when live event changes
  useEffect(() => {
    if (!liveEvent) {
      setIncidents([]);
      return;
    }

    const loadIncidents = async () => {
      try {
        console.log('Loading incidents for event:', liveEvent.id);
        const data = await incidentService.getIncidentsByEvent(liveEvent.id);
        console.log('Loaded incidents from MongoDB:', data.length);
        
        // Convert timestamp strings to Date objects
        const incidentsWithDates = data.map(inc => ({
          ...inc,
          timestamp: new Date(inc.timestamp)
        }));
        setIncidents(incidentsWithDates);
      } catch (error) {
        console.error('Error loading incidents:', error);
        setIncidents([]);
      }
    };

    loadIncidents();
  }, [liveEvent?.id]);

  // Poll for new incidents every 3 seconds to show real-time updates
  useEffect(() => {
    if (!liveEvent) return;
    
    const intervalId = setInterval(async () => {
      try {
        const data = await incidentService.getIncidentsByEvent(liveEvent.id);
        const incidentsWithDates = data.map(inc => ({
          ...inc,
          timestamp: new Date(inc.timestamp)
        }));
        setIncidents(incidentsWithDates);
      } catch (error) {
        console.error('Error refreshing incidents:', error);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [liveEvent?.id]);

  // Fetch crowd density data
  useEffect(() => {
    if (!liveEvent?.id) return;

    const fetchCrowdDensity = async () => {
      try {
        const data = await crowdAnalysisService.getLatestDensityByZone(liveEvent.id);
        setCrowdDensity(data);
        
        // Calculate average density
        if (data.length > 0) {
          const avg = data.reduce((sum, zone) => sum + zone.densityPercentage, 0) / data.length;
          setAvgCrowdDensity(Math.round(avg));
        }
      } catch (error) {
        console.error('Error fetching crowd density:', error);
      }
    };

    fetchCrowdDensity();
    const intervalId = setInterval(fetchCrowdDensity, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, [liveEvent?.id]);

  const handleSubmitReport = async () => {
    if (!newIncident.description.trim() || !newIncident.location) return;
    if (!liveEvent) return;

    try {
      console.log('=== Submitting Incident ===');
      console.log('Event ID:', liveEvent.id);
      console.log('Reporter:', user?.name);
      
      const incidentData = {
        eventId: liveEvent.id,
        type: newIncident.type,
        description: newIncident.description.trim(),
        location: newIncident.location,
        reporter: user?.name || 'Anonymous',
        reporterEmail: user?.email,
      };
      
      const savedIncident = await incidentService.createIncident(incidentData);
      console.log('Incident saved to MongoDB:', savedIncident);
      
      // Refresh incidents list
      const allIncidents = await incidentService.getIncidentsByEvent(liveEvent.id);
      const incidentsWithDates = allIncidents.map(inc => ({
        ...inc,
        timestamp: new Date(inc.timestamp)
      }));
      setIncidents(incidentsWithDates);
      
      setNewIncident({ type: 'general', description: '', location: '' });
      setLostFoundImage(null);
      setShowReportForm(false);
      
      console.log('Total incidents now:', incidentsWithDates.length);
      console.log('========================');
    } catch (error) {
      console.error('Error submitting incident:', error);
      alert('Failed to submit incident. Please try again.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLostFoundImage(file);
    }
  };

  const handleUpdateIncidentStatus = async (incidentId: string, newStatus: 'open' | 'investigating' | 'resolved') => {
    if (!liveEvent) return;
    
    try {
      await incidentService.updateIncidentStatus(incidentId, newStatus);
      
      // Refresh incidents list
      const allIncidents = await incidentService.getIncidentsByEvent(liveEvent.id);
      const incidentsWithDates = allIncidents.map(inc => ({
        ...inc,
        timestamp: new Date(inc.timestamp)
      }));
      setIncidents(incidentsWithDates);
    } catch (error) {
      console.error('Error updating incident status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-ai-white bg-ai-white/20';
      case 'investigating': return 'text-ai-gray-300 bg-ai-gray-300/20';
      case 'resolved': return 'text-ai-gray-500 bg-ai-gray-500/20';
      default: return 'text-ai-gray-400 bg-ai-gray-500/20';
    }
  };

  const getSafetyStatusColor = (status: string) => {
    switch (status) {
      case 'OPTIMAL': return 'text-ai-white bg-ai-white/20';
      case 'CAUTION': return 'text-ai-gray-300 bg-ai-gray-300/20';
      case 'ALERT': return 'text-ai-white bg-ai-white/20';
      default: return 'text-ai-gray-400 bg-ai-gray-500/20';
    }
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Eye className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              Live Safety Dashboard
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto mb-2">
              {user?.role === 'organizer'
                ? 'Comprehensive event safety oversight and incident management'
                : 'Report incidents and view live safety status'
              }
            </p>
            {liveEvent && (
              <div className="inline-flex items-center gap-2 px-4 py-2 glass-light rounded-full mt-2">
                <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse" />
                <span className="text-ai-white font-medium">{stats.eventName}</span>
              </div>
            )}
          </motion.div>

          {/* No Live Event Message for Participants */}
          {!liveEvent && user?.role === 'participant' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-light rounded-2xl p-12 mb-8 text-center"
            >
              <h3 className="text-2xl font-semibold text-ai-white mb-2">No Live Event</h3>
              <p className="text-ai-gray-400 mb-6 max-w-md mx-auto">
                You don't have any events happening right now. Register for an event to access live monitoring features.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/explore-events')}
                  className="px-6 py-3 bg-ai-white text-ai-black rounded-xl font-medium transition-all duration-300"
                >
                  Browse Events
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/my-events')}
                  className="px-6 py-3 glass-medium hover:glass-strong text-ai-white rounded-xl font-medium transition-all duration-300"
                >
                  My Events
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Show full content only when live event exists OR user is organizer */}
          {(liveEvent || user?.role === 'organizer') && (
            <>
              {/* Safety Status Banner */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-light rounded-2xl p-6 mb-8"
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Shield className="w-12 h-12 text-ai-white" />
                    <div>
                      <h3 className="text-xl font-semibold text-white">Event Safety Status</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSafetyStatusColor(stats.safetyStatus)}`}>
                          {stats.safetyStatus}
                        </span>
                        <span className="text-gray-400">Last updated: {new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <div className="text-2xl font-bold text-ai-white">{stats.crowdLevel}%</div>
                      <div className="text-sm text-ai-gray-400">Crowd Level</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-ai-white">{stats.emergencyUnits}</div>
                      <div className="text-sm text-ai-gray-400">Units Ready</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-ai-white">{stats.responseTime}m</div>
                      <div className="text-sm text-gray-400">Avg Response</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* No Live Event Message for Organizers */}
              {!liveEvent && user?.role === 'organizer' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-light rounded-2xl p-12 mb-8 text-center"
                >
                  <Eye className="w-16 h-16 mx-auto mb-4 text-ai-gray-500" />
                  <h3 className="text-2xl font-semibold text-ai-white mb-2">No Live Event</h3>
                  <p className="text-ai-gray-400 mb-6 max-w-md mx-auto">
                    You don't have any events happening right now. Create or register for an event to access live monitoring features.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/explore-events')}
                      className="px-6 py-3 bg-ai-white text-ai-black rounded-xl font-medium transition-all duration-300"
                    >
                      Browse Events
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/my-events')}
                      className="px-6 py-3 glass-medium hover:glass-strong text-ai-white rounded-xl font-medium transition-all duration-300"
                    >
                      My Events
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* Show detailed monitoring only when live event exists */}
          {liveEvent && (
            <>
              {/* Organizer Stats */}
              {user?.role === 'organizer' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
                >
                  <div className="glass-light rounded-2xl p-6 text-center">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-ai-white" />
                    <div className="text-2xl font-bold text-white">{stats.activeIncidents}</div>
                    <div className="text-sm text-ai-gray-400">Active Incidents</div>
                  </div>
                  
                  <div className="glass-light rounded-2xl p-6 text-center">
                    <Camera className="w-8 h-8 mx-auto mb-2 text-ai-white" />
                    <div className="text-2xl font-bold text-white">{stats.cameras}</div>
                    <div className="text-sm text-ai-gray-400">Cameras Online</div>
                  </div>
                  
                  <div className="glass-light rounded-2xl p-6 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-ai-white" />
                    <div className="text-2xl font-bold text-white">{stats.zones}</div>
                    <div className="text-sm text-ai-gray-400">Zones Monitored</div>
                  </div>
                  
                  <div className="glass-light rounded-2xl p-6 text-center">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-ai-white" />
                    <div className="text-2xl font-bold text-white">{stats.safetyScore}</div>
                    <div className="text-sm text-gray-400">Safety Score</div>
                  </div>
                </motion.div>
              )}

              {/* Live Crowd Density Section */}
              {user?.role === 'organizer' && crowdDensity.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="glass-light rounded-2xl p-6 mb-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Activity className="w-6 h-6 text-ai-white" />
                      <h3 className="text-xl font-semibold text-white">Live Crowd Density</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold text-ai-white">{stats.crowdDensity}%</div>
                      <span className="text-sm text-ai-gray-400">Average</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {crowdDensity.map((zone) => (
                      <div key={zone.zoneId} className="glass-medium rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-ai-white">{zone.zoneName}</span>
                          <span className={`text-lg font-bold ${
                            zone.densityPercentage >= 80 ? 'text-red-400' :
                            zone.densityPercentage >= 60 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {Math.round(zone.densityPercentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-ai-gray-700 rounded-full h-2">
                          <motion.div
                            className={`h-2 rounded-full ${
                              zone.densityPercentage >= 80 ? 'bg-red-500' :
                              zone.densityPercentage >= 60 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(zone.densityPercentage, 100)}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-ai-gray-400">
                          {zone.peopleCount} people detected
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between text-xs text-ai-gray-500">
                    <span>Last updated: {crowdDensity[0] ? new Date(crowdDensity[0].timestamp).toLocaleTimeString() : 'N/A'}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse" />
                      <span>Live</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Incident Reports */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-light rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-ai-white" />
                        Recent Incidents
                      </h3>
                      {user?.role === 'participant' && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowReportForm(true)}
                          className="px-4 py-2 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                        >
                          Report Incident
                        </motion.button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {incidents.map((incident, index) => (
                        <motion.div
                          key={incident._id || incident.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-ai-gray-800/30 rounded-xl p-4 border border-ai-gray-800"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`w-10 h-10 ${incidentTypes[incident.type].color} rounded-lg flex items-center justify-center text-lg`}>
                                {incidentTypes[incident.type].icon}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-white">{incidentTypes[incident.type].label}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(incident.status)}`}>
                                    {incident.status}
                                  </span>
                                </div>
                                
                                <p className="text-ai-gray-400 mb-2">{incident.description}</p>
                                
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-ai-white">📍 {incident.location}</span>
                                  <span className="text-ai-gray-500">
                                    {incident.timestamp.toLocaleTimeString()} by {incident.reporter}
                                  </span>
                                </div>

                                {/* Response Time - Show for resolved incidents */}
                                {incident.status === 'resolved' && incident.responseTime && (
                                  <div className="mt-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg">
                                    <span className="text-green-400 text-sm font-medium">
                                      ✓ Resolved in {Math.floor(incident.responseTime / 60)}m {incident.responseTime % 60}s
                                    </span>
                                  </div>
                                )}

                                {/* Organizer Actions */}
                                {user?.role === 'organizer' && incident.status !== 'resolved' && (
                                  <div className="flex gap-2 mt-3">
                                    {incident.status === 'open' && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleUpdateIncidentStatus(incident._id || incident.id || '', 'investigating')}
                                        className="px-3 py-1 bg-ai-white/10 hover:bg-ai-white/20 text-ai-white rounded-lg text-xs font-medium transition-colors"
                                      >
                                        Mark Investigating
                                      </motion.button>
                                    )}
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleUpdateIncidentStatus(incident._id || incident.id || '', 'resolved')}
                                      className="px-3 py-1 bg-ai-white/10 hover:bg-ai-white/20 text-ai-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                      Mark Resolved
                                    </motion.button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      
                      {incidents.length === 0 && (
                        <div className="text-center py-8 text-ai-gray-500">
                          No incidents reported
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Live Map */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-light rounded-2xl p-6"
                  >
                    <h3 className="text-xl font-semibold text-white mb-4">
                      {user?.role === 'organizer' ? 'Live Event Map' : 'Event Venue Map'}
                    </h3>
                    <div className="aspect-video bg-ai-gray-800/50 rounded-xl relative overflow-hidden">
                      {/* Event Map Image */}
                      {liveEvent.mapFile ? (
                        <img 
                          src={liveEvent.mapFile} 
                          alt="Event venue map" 
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                      ) : (
                        /* Fallback gradient when no map uploaded */
                        <div className="absolute inset-0 opacity-20">
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
                        </div>
                      )}
                      
                      {/* Incident markers - Only for organizers */}
                      {user?.role === 'organizer' && incidents.slice(0, 4).map((incident, i) => (
                        <motion.div
                          key={incident._id || incident.id || i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute w-4 h-4 ${incidentTypes[incident.type].color} rounded-full ${
                            i === 0 ? 'top-1/4 left-1/4' :
                            i === 1 ? 'top-1/3 right-1/3' :
                            i === 2 ? 'bottom-1/3 left-1/2' :
                            'bottom-1/4 right-1/4'
                          }`}
                          style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
                        />
                      ))}
                      
                      {/* Zone labels */}
                      {liveEvent.zones && liveEvent.zones.length > 0 ? (
                        liveEvent.zones.slice(0, 4).map((zone, i) => (
                          <div 
                            key={zone}
                            className={`absolute text-white text-sm font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded ${
                              i === 0 ? 'top-4 left-4' :
                              i === 1 ? 'top-4 right-4' :
                              i === 2 ? 'bottom-4 left-4' :
                              'bottom-4 right-4'
                            }`}
                          >
                            {zone}
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="absolute top-4 left-4 text-white text-sm font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded">Main Stage</div>
                          <div className="absolute top-4 right-4 text-white text-sm font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded">VIP Area</div>
                          <div className="absolute bottom-4 left-4 text-white text-sm font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded">Food Court</div>
                          <div className="absolute bottom-4 right-4 text-white text-sm font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded">Exits</div>
                        </>
                      )}
                    </div>
                    
                    {/* Map Information */}
                    {!liveEvent.mapFile && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ℹ️ No venue map has been uploaded for this event.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-light rounded-2xl p-6"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    
                    <div className="space-y-3">
                      {user?.role === 'participant' && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowReportForm(true)}
                            className="w-full p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg text-red-300 hover:text-white transition-colors"
                          >
                            🚨 Emergency Report
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setNewIncident({ ...newIncident, type: 'lost_found' });
                              setShowReportForm(true);
                            }}
                            className="w-full p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-300 hover:text-white transition-colors"
                          >
                            📱 Lost & Found
                          </motion.button>
                        </>
                      )}
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full p-3 bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/50 rounded-lg text-gray-300 hover:text-white transition-colors"
                      >
                        📞 Contact Security
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full p-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 rounded-lg text-green-300 hover:text-white transition-colors"
                      >
                        ℹ️ Event Info
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Zone Status */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-light rounded-2xl p-6"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">Zone Status</h3>
                    
                    <div className="space-y-3">
                      {zones.slice(0, 5).map((zone, index) => {
                        const status = Math.random() > 0.7 ? 'caution' : 'normal';
                        const crowdLevel = Math.floor(Math.random() * 40) + 30;
                        
                        return (
                          <div key={zone} className="flex items-center justify-between">
                            <span className="text-ai-gray-300 text-sm">{zone}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-ai-gray-400">{crowdLevel}%</span>
                              <div className={`w-2 h-2 rounded-full ${
                                status === 'normal' ? 'bg-ai-white' : 'bg-ai-gray-400'
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              </div>
            </>
          )}

          {/* Report Form Modal */}
          {showReportForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setShowReportForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-light rounded-2xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Report Incident</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                      Incident Type
                    </label>
                    <select
                      value={newIncident.type}
                      onChange={(e) => setNewIncident({ ...newIncident, type: e.target.value as any })}
                      className="w-full px-3 py-2 bg-ai-gray-800/50 border border-ai-gray-800 rounded-lg text-white focus:border-ai-white focus:outline-none"
                    >
                      {Object.entries(incidentTypes).map(([key, type]) => (
                        <option key={key} value={key}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                      Location
                    </label>
                    <select
                      value={newIncident.location}
                      onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })}
                      className="w-full px-3 py-2 bg-ai-gray-800/50 border border-ai-gray-800 rounded-lg text-white focus:border-ai-white focus:outline-none"
                    >
                      <option value="">Select location</option>
                      {zones.map(zone => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newIncident.description}
                      onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                      placeholder="Describe the incident..."
                      rows={3}
                      className="w-full px-3 py-2 bg-ai-gray-800/50 border border-ai-gray-800 rounded-lg text-white placeholder-gray-400 focus:border-ai-white focus:outline-none resize-none"
                    />
                  </div>

                  {newIncident.type === 'lost_found' && (
                    <div>
                      <label className="block text-sm font-medium text-ai-gray-300 mb-2">
                        Upload Photo (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="w-full px-3 py-2 bg-ai-gray-800/50 border border-ai-gray-800 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-ai-white file:text-ai-black hover:file:bg-ai-gray-300"
                      />
                      {lostFoundImage && (
                        <p className="text-sm text-ai-gray-400 mt-1">Selected: {lostFoundImage.name}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowReportForm(false)}
                      className="flex-1 px-4 py-2 bg-ai-gray-600 rounded-lg text-white hover:bg-ai-gray-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmitReport}
                      disabled={!newIncident.description.trim() || !newIncident.location}
                      className="flex-1 px-4 py-2 bg-ai-white text-ai-black rounded-lg hover:bg-ai-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Report
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoring;