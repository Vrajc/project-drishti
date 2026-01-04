import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Truck, Clock, Route, Phone, CheckCircle, Navigation } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { incidentService } from '../services/incident.service';

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

interface Emergency {
  id: string;
  type: 'medical' | 'fire' | 'security' | 'evacuation';
  location: string;
  coordinates: { lat: number; lng: number };
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  status: 'pending' | 'dispatched' | 'en-route' | 'on-scene' | 'resolved';
  assignedUnit?: string;
  estimatedTime?: number;
  routeDistance?: number;
}

interface ResponderUnit {
  id: string;
  type: 'ambulance' | 'fire_truck' | 'security' | 'police';
  location: string;
  coordinates: { lat: number; lng: number };
  status: 'available' | 'busy' | 'offline';
  eta?: number;
}

const EmergencyDispatch: React.FC = () => {
  const { event, getEventsByOrganizer } = useEvent();
  const { user } = useAuth();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [responders, setResponders] = useState<ResponderUnit[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Helper function to check if event is live
  const isEventLive = (date: string, time: string): boolean => {
    const now = new Date();
    const eventDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
    return now >= eventDate && now <= eventEndTime;
  };

  // Get organizer's live event
  const organizerEvents = getEventsByOrganizer(user?.email || '');
  const liveEvent = organizerEvents.find(e => isEventLive(e.date, e.time)) || event;

  // Get dispatch units from event setup
  const eventDispatchUnits = liveEvent?.dispatchUnits || [];

  // Debug logging
  useEffect(() => {
    console.log('=== Emergency Dispatch Debug ===');
    console.log('User:', user?.email);
    console.log('Organizer Events:', organizerEvents);
    console.log('Live Event:', liveEvent);
    console.log('Live Event ID:', liveEvent?.id);
    console.log('Dispatch Units:', eventDispatchUnits);
    console.log('Number of Dispatch Units:', eventDispatchUnits.length);
    if (eventDispatchUnits.length > 0) {
      console.log('First Dispatch Unit:', eventDispatchUnits[0]);
    }
    if (liveEvent) {
      console.log('Checking localStorage key:', `drishti_incidents_${liveEvent.id}`);
      const stored = localStorage.getItem(`drishti_incidents_${liveEvent.id}`);
      console.log('Stored incidents:', stored);
    }
    console.log('==============================');
  }, [liveEvent?.id, eventDispatchUnits.length]);

  // Load incidents from MongoDB and convert medical/security incidents to emergencies
  useEffect(() => {
    if (!liveEvent) return;

    const loadIncidents = async () => {
      try {
        const data = await incidentService.getIncidentsByEvent(liveEvent.id);
        const incidentsWithDates = data.map(inc => ({
          ...inc,
          timestamp: new Date(inc.timestamp)
        }));
        setIncidents(incidentsWithDates);

        // Convert medical and security incidents to emergencies
        const emergencyIncidents = incidentsWithDates.filter(
          (inc: Incident) => inc.type === 'medical' || inc.type === 'security'
        );

        const convertedEmergencies: Emergency[] = emergencyIncidents.map((inc: Incident) => {
          let emergencyType: 'medical' | 'security' = inc.type as 'medical' | 'security';
          let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
          
          // Determine priority based on incident description
          const desc = inc.description.toLowerCase();
          if (desc.includes('critical') || desc.includes('severe') || desc.includes('emergency')) {
            priority = 'critical';
          } else if (desc.includes('urgent') || desc.includes('serious')) {
            priority = 'high';
          }

          // Map incident status to emergency status
          let emergencyStatus: 'pending' | 'dispatched' | 'en-route' | 'on-scene' | 'resolved' = 'pending';
          if (inc.status === 'resolved') {
            emergencyStatus = 'resolved';
          } else if (inc.status === 'investigating') {
            emergencyStatus = 'dispatched';
          } else {
            emergencyStatus = 'pending';
          }

          return {
            id: inc._id || inc.id || '',
            type: emergencyType,
            location: inc.location,
            coordinates: { lat: 40.7128 + (Math.random() - 0.5) * 0.01, lng: -74.0060 + (Math.random() - 0.5) * 0.01 },
            priority,
            timestamp: inc.timestamp,
            status: emergencyStatus
          };
        });

        setEmergencies(convertedEmergencies);
      } catch (error) {
        console.error('Error loading incidents:', error);
      }
    };

    loadIncidents();

    // Poll for new incidents every 3 seconds
    const intervalId = setInterval(loadIncidents, 3000);
    return () => clearInterval(intervalId);
  }, [liveEvent?.id]);

  const emergencyTypes = {
    medical: { icon: Phone, color: 'bg-ai-white/20', label: 'Medical' },
    fire: { icon: Truck, color: 'bg-ai-white/20', label: 'Fire' },
    security: { icon: MapPin, color: 'bg-ai-gray-600/20', label: 'Security' },
    evacuation: { icon: Navigation, color: 'bg-ai-gray-600/20', label: 'Evacuation' }
  };

  const responderTypes = {
    ambulance: { label: 'Ambulance', icon: '🚑' },
    fire_truck: { label: 'Fire Truck', icon: '🚒' },
    security: { label: 'Security', icon: '🚓' },
    police: { label: 'Police', icon: '👮' }
  };

  const priorityColors = {
    low: 'border-ai-gray-600 bg-ai-gray-600/10',
    medium: 'border-ai-gray-600 bg-ai-gray-600/10',
    high: 'border-ai-white bg-ai-white/10',
    critical: 'border-ai-white bg-ai-white/10'
  };

  const generateMockEmergency = (): Emergency => {
    const types = ['medical', 'fire', 'security', 'evacuation'] as const;
    const priorities = ['low', 'medium', 'high', 'critical'] as const;
    const locations = ['Main Stage Area', 'Food Court', 'VIP Section', 'Parking Lot A', 'Emergency Exit 2', 'Restroom Block C'];
    
    const type = types[Math.floor(Math.random() * types.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      priority,
      location: locations[Math.floor(Math.random() * locations.length)],
      coordinates: {
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.0060 + (Math.random() - 0.5) * 0.01
      },
      timestamp: new Date(),
      status: 'pending'
    };
  };

  const generateMockResponders = (): ResponderUnit[] => {
    const types = ['ambulance', 'fire_truck', 'security', 'police'] as const;
    const locations = ['Station 1', 'Station 2', 'Mobile Unit A', 'Mobile Unit B', 'Patrol 1', 'Patrol 2'];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `unit-${i + 1}`,
      type: types[Math.floor(Math.random() * types.length)],
      location: locations[i % locations.length],
      coordinates: {
        lat: 40.7128 + (Math.random() - 0.5) * 0.02,
        lng: -74.0060 + (Math.random() - 0.5) * 0.02
      },
      status: Math.random() > 0.7 ? 'busy' : 'available'
    }));
  };

  useEffect(() => {
    if (isActive) {
      if (eventDispatchUnits.length > 0) {
        // Convert event dispatch units to responder format
        const units: ResponderUnit[] = eventDispatchUnits.map(unit => {
          // Map dispatch unit types to responder types
          let responderType: 'ambulance' | 'fire_truck' | 'security' | 'police' = 'security';
          if (unit.type.toLowerCase().includes('ambulance') || unit.type.toLowerCase().includes('medical')) {
            responderType = 'ambulance';
          } else if (unit.type.toLowerCase().includes('fire')) {
            responderType = 'fire_truck';
          } else if (unit.type.toLowerCase().includes('police')) {
            responderType = 'police';
          }
          
          return {
            id: unit.name,
            type: responderType,
            location: unit.location || 'Base Location',
            coordinates: { lat: 0, lng: 0 }, // Would be set from real location
            status: 'available'
          };
        });
        console.log('Setting responders from event dispatch units:', units);
        setResponders(units);
      } else {
        // Fallback to mock responders if no event dispatch units configured
        console.log('No event dispatch units, using mock responders');
        setResponders(generateMockResponders());
      }
    } else {
      // Clear responders when system is deactivated
      setResponders([]);
    }
  }, [isActive, eventDispatchUnits]);

  const calculateOptimalRoute = async (emergency: Emergency) => {
    // Mock optimal routing calculation
    const availableResponders = responders.filter(r => r.status === 'available');
    if (availableResponders.length === 0) return;

    // Find closest responder (mock calculation)
    const closestResponder = availableResponders[Math.floor(Math.random() * availableResponders.length)];
    const estimatedTime = Math.floor(Math.random() * 10) + 2; // 2-12 minutes
    const routeDistance = Math.floor(Math.random() * 5) + 1; // 1-6 km

    // Update incident status in MongoDB to 'investigating' when dispatched
    try {
      await incidentService.updateIncidentStatus(emergency.id, 'investigating');
      console.log('Incident status updated to investigating for emergency:', emergency.id);
    } catch (error) {
      console.error('Error updating incident status:', error);
    }

    // Update emergency locally
    setEmergencies(prev => prev.map(e => 
      e.id === emergency.id 
        ? { 
            ...e, 
            status: 'dispatched', 
            assignedUnit: closestResponder.id,
            estimatedTime,
            routeDistance
          }
        : e
    ));

    // Update responder status
    setResponders(prev => prev.map(r => 
      r.id === closestResponder.id 
        ? { ...r, status: 'busy', eta: estimatedTime }
        : r
    ));

    // Simulate status updates
    setTimeout(() => {
      setEmergencies(prev => prev.map(e => 
        e.id === emergency.id ? { ...e, status: 'en-route' } : e
      ));
    }, 2000);

    setTimeout(async () => {
      setEmergencies(prev => prev.map(e => 
        e.id === emergency.id ? { ...e, status: 'on-scene' } : e
      ));
      
      // Mark incident as resolved when team is on-scene
      try {
        await incidentService.updateIncidentStatus(emergency.id, 'resolved');
        console.log('Incident marked as resolved:', emergency.id);
      } catch (error) {
        console.error('Error resolving incident:', error);
      }
    }, estimatedTime * 1000);
  };

  const toggleSystem = () => {
    setIsActive(!isActive);
    if (!isActive) {
      // Real emergencies will come from monitoring system
      setEmergencies([]);
    } else {
      setEmergencies([]);
      setResponders([]);
      setSelectedEmergency(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-ai-white bg-ai-white/20';
      case 'dispatched': return 'text-ai-gray-300 bg-ai-gray-300/20';
      case 'en-route': return 'text-ai-gray-400 bg-ai-gray-400/20';
      case 'on-scene': return 'text-ai-gray-400 bg-ai-gray-400/20';
      case 'resolved': return 'text-ai-gray-500 bg-ai-gray-500/20';
      default: return 'text-ai-gray-400 bg-ai-gray-500/20';
    }
  };

  const pendingEmergencies = emergencies.filter(e => e.status === 'pending');
  const activeDispatches = emergencies.filter(e => ['dispatched', 'en-route', 'on-scene'].includes(e.status));
  const availableUnits = responders.filter(r => r.status === 'available');

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
            <Truck className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              Emergency Dispatch
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Automated emergency response system with optimal routing and real-time coordination
            </p>
          </motion.div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-light rounded-2xl p-6 text-center">
              <Phone className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{pendingEmergencies.length}</div>
              <div className="text-sm text-ai-gray-400">Pending</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <Route className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{activeDispatches.length}</div>
              <div className="text-sm text-ai-gray-400">Active Dispatches</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <Truck className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{availableUnits.length}</div>
              <div className="text-sm text-ai-gray-400">Available Units</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">-</div>
              <div className="text-sm text-ai-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="glass-light rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Dispatch Control Center</h3>
                <p className="text-ai-gray-400">AI-powered emergency response coordination system</p>
                {!event && (
                  <p className="text-sm text-yellow-400 mt-2">⚠️ No event selected. Please setup or select an event first.</p>
                )}
                {event && eventDispatchUnits.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-2">⚠️ No dispatch units configured in Event Setup. Add units in Event Setup page.</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-sm ${
                  isActive ? 'bg-ai-white/20 text-ai-white' : 'bg-ai-gray-500/20 text-ai-gray-400'
                }`}>
                  {isActive ? '● Active' : '○ Standby'}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSystem}
                  className="px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                >
                  {isActive ? 'Deactivate System' : 'Activate System'}
                </motion.button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Emergency Queue */}
            <div className="glass-light rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Phone className="w-6 h-6 text-ai-white" />
                Emergency Queue
                {pendingEmergencies.length > 0 && (
                  <span className="bg-ai-white/20 text-ai-white px-2 py-1 rounded-full text-sm">
                    {pendingEmergencies.length}
                  </span>
                )}
              </h3>
              
              <div className="space-y-4">
                {emergencies.slice(0, 6).map((emergency, index) => {
                  const EmergencyIcon = emergencyTypes[emergency.type].icon;
                  const emergencyColor = emergencyTypes[emergency.type].color;
                  
                  return (
                    <motion.div
                      key={emergency.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border rounded-xl p-4 ${priorityColors[emergency.priority]} ${
                        emergency.status === 'pending' ? 'border-red-500/50' : ''
                      }`}
                      onClick={() => setSelectedEmergency(emergency)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 ${emergencyColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <EmergencyIcon className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-white">{emergencyTypes[emergency.type].label}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                emergency.priority === 'critical' ? 'bg-ai-white/20 text-ai-white' :
                                emergency.priority === 'high' ? 'bg-ai-gray-600/20 text-ai-gray-300' :
                                emergency.priority === 'medium' ? 'bg-ai-gray-600/20 text-ai-gray-300' :
                                'bg-ai-gray-600/20 text-ai-gray-300'
                              }`}>
                                {emergency.priority}
                              </span>
                            </div>
                            
                            <p className="text-ai-gray-400 text-sm mb-2">📍 {emergency.location}</p>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-ai-gray-500">
                                {emergency.timestamp.toLocaleTimeString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(emergency.status)}`}>
                                {emergency.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {emergency.status === 'pending' && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              calculateOptimalRoute(emergency);
                            }}
                            className="px-3 py-1 bg-ai-white text-ai-black rounded-lg hover:bg-ai-gray-300 text-sm transition-colors"
                          >
                            Dispatch
                          </motion.button>
                        )}
                      </div>

                      {emergency.assignedUnit && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-ai-gray-700"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-ai-white">Unit: {emergency.assignedUnit}</span>
                            <span className="text-ai-white">ETA: {emergency.estimatedTime}m</span>
                            <span className="text-ai-white">{emergency.routeDistance}km</span>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
                
                {emergencies.length === 0 && isActive && (
                  <div className="text-center py-8 text-ai-gray-500">
                    No emergencies in queue
                  </div>
                )}
                
                {!isActive && (
                  <div className="text-center py-8 text-ai-gray-500">
                    Activate system to monitor emergencies
                  </div>
                )}
              </div>
            </div>

            {/* Map and Responders */}
            <div className="space-y-6">
              {/* Live Map */}
              <div className="glass-light rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-ai-white" />
                  Live Dispatch Map
                </h3>
                <div className="aspect-square bg-ai-gray-800/50 rounded-xl relative overflow-hidden">
                  {/* Display uploaded venue image if available */}
                  {event?.mapFile ? (
                    <div className="absolute inset-0">
                      <img 
                        src={typeof event.mapFile === 'string' ? event.mapFile : URL.createObjectURL(event.mapFile)}
                        alt="Venue Map"
                        className="w-full h-full object-cover rounded-xl opacity-30"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 opacity-20">
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
                    </div>
                  )}
                  
                  {isActive && (
                    <>
                      {/* Emergency markers */}
                      {emergencies.slice(0, 4).map((emergency, i) => (
                        <motion.div
                          key={emergency.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute w-4 h-4 ${
                            emergency.status === 'pending' ? 'bg-ai-white' : 'bg-ai-gray-400'
                          } rounded-full ${
                            i === 0 ? 'top-1/4 left-1/4' :
                            i === 1 ? 'top-1/3 right-1/3' :
                            i === 2 ? 'bottom-1/3 left-1/2' :
                            'bottom-1/4 right-1/4'
                          }`}
                          style={{
                            filter: 'drop-shadow(0 0 8px currentColor)'
                          }}
                        />
                      ))}
                      
                      {/* Responder markers */}
                      {responders.slice(0, 6).map((responder, i) => (
                        <motion.div
                          key={responder.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute w-3 h-3 ${
                            responder.status === 'available' ? 'bg-ai-white' : 'bg-ai-gray-500'
                          } rounded-full ${
                            i === 0 ? 'top-1/5 left-1/5' :
                            i === 1 ? 'top-2/5 right-1/5' :
                            i === 2 ? 'bottom-2/5 left-1/3' :
                            i === 3 ? 'bottom-1/5 right-1/3' :
                            i === 4 ? 'top-1/2 left-1/6' :
                            'top-3/5 right-1/6'
                          }`}
                        />
                      ))}
                      
                      {/* Route lines */}
                      <svg className="absolute inset-0 w-full h-full">
                        {activeDispatches.map((emergency, i) => (
                          <motion.line
                            key={emergency.id}
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            x1={`${20 + i * 20}%`}
                            y1={`${30 + i * 15}%`}
                            x2={`${60 + i * 10}%`}
                            y2={`${70 - i * 15}%`}
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            className="animate-pulse"
                          />
                        ))}
                      </svg>
                    </>
                  )}
                  
                  {!isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-ai-black/70 backdrop-blur-sm rounded-xl p-4 text-ai-gray-400">
                        Activate system to view live map
                      </div>
                    </div>
                  )}
                  
                  {!event?.mapFile && isActive && (
                    <div className="absolute bottom-4 left-4 right-4 bg-ai-black/70 backdrop-blur-sm rounded-lg p-3 text-center">
                      <p className="text-ai-gray-400 text-sm">
                        No venue map uploaded. Using default visualization.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Responder Units */}
              <div className="glass-light rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Truck className="w-6 h-6 text-ai-white" />
                  Responder Units
                  {eventDispatchUnits.length > 0 && isActive && (
                    <span className="text-sm text-ai-gray-400">({responders.length} from Event Setup)</span>
                  )}
                </h3>
                
                <div className="space-y-3">
                  {responders.map((responder, index) => {
                    // Find original dispatch unit info
                    const dispatchUnit = eventDispatchUnits.find(u => u.name === responder.id);
                    
                    return (
                      <motion.div
                        key={responder.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 bg-ai-gray-800/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-xl">{responderTypes[responder.type].icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-white">{responder.id}</div>
                            <div className="text-sm text-ai-gray-400">{responder.location}</div>
                            {dispatchUnit && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-ai-gray-500">
                                {dispatchUnit.contact && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {dispatchUnit.contact}
                                  </span>
                                )}
                                {dispatchUnit.capacity && (
                                  <span>Capacity: {dispatchUnit.capacity}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {responder.eta && (
                            <span className="text-sm text-ai-white">ETA: {responder.eta}m</span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            responder.status === 'available' ? 'bg-ai-white/20 text-ai-white' :
                            responder.status === 'busy' ? 'bg-ai-gray-600/20 text-ai-gray-400' :
                            'bg-ai-gray-500/20 text-ai-gray-400'
                          }`}>
                            {responder.status}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {responders.length === 0 && isActive && (
                    <div className="text-center py-4 text-ai-gray-500">
                      {eventDispatchUnits.length === 0 
                        ? 'No dispatch units configured in Event Setup' 
                        : 'No responder units available'}
                    </div>
                  )}
                  
                  {!isActive && (
                    <div className="text-center py-4 text-ai-gray-500">
                      Activate system to view responder units
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyDispatch;