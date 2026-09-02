import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Truck, Clock, Route, Phone, Navigation } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { incidentService } from '../services/incident.service';
import { dispatchService } from '../services/dispatch.service';

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
  /** Null when nobody has classified it — the report form does not ask. */
  severity?: 'low' | 'medium' | 'high' | 'critical' | null;
  /** Units currently committed to this incident, as the server reports them. */
  activeAssignments?: Array<{ id: string; status: string; unit: { name: string } }>;
  responseTime?: number;
  resolvedAt?: Date;
}

interface Emergency {
  id: string;
  type: 'medical' | 'fire' | 'security' | 'evacuation';
  location: string;
  /** The recorded severity, or null when nobody has classified the incident. */
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  timestamp: Date;
  status: 'pending' | 'dispatched' | 'en-route' | 'on-scene' | 'resolved';
  assignedUnit?: string;
}

interface ResponderUnit {
  id: string;
  /** DispatchUnit.unitId — the stable identifier, not the display name. */
  unitId: string;
  name: string;
  type: 'ambulance' | 'fire_truck' | 'security' | 'police';
  location: string;
  status: 'available' | 'busy' | 'offline';
}

const EmergencyDispatch: React.FC = () => {
  const { event, getEventsByOrganizer } = useEvent();
  const { user } = useAuth();
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [responders, setResponders] = useState<ResponderUnit[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [, setSelectedEmergency] = useState<Emergency | null>(null);
  const [, setIncidents] = useState<Incident[]>([]);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

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

          // Priority is the severity somebody recorded, or null. It used to be
          // guessed by searching the description for the words "critical",
          // "severe" and "urgent" - so "not urgent" read as high priority, a
          // report written in any other language read as medium, and the queue
          // an operator worked through was ordered by vocabulary.
          const priority = (inc.severity ?? null) as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical'
            | null;

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
            priority,
            timestamp: inc.timestamp,
            status: emergencyStatus,
            // Read from the incident's live assignments rather than remembered
            // in component state, so it survives a reload and matches what the
            // police console sees for the same incident.
            assignedUnit: inc.activeAssignments?.[0]?.unit?.name,
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

  // Keyed by the recorded severity. `unassessed` is its own entry rather than a
  // fallback into 'medium': an incident nobody has classified must not be shown
  // in the colour of one somebody classified as moderate.
  const priorityColors: Record<string, string> = {
    unassessed: 'border-ai-gray-700 bg-transparent',
    low: 'border-ai-gray-600 bg-ai-gray-600/10',
    medium: 'border-ai-gray-600 bg-ai-gray-600/10',
    high: 'border-ai-white bg-ai-white/10',
    critical: 'border-ai-white bg-ai-white/10'
  };

  // Responders come from the event's DispatchUnit rows and nowhere else. There
  // is no fallback: an event with no units configured shows an empty state,
  // because inventing eight units at New York coordinates is worse than none.
  //
  // Read from the dispatch API rather than the event payload cached in context:
  // that gave every unit the literal status 'available', so a unit already sent
  // somewhere still showed as free to send. The status here is the row's own.
  const loadUnits = useCallback(async () => {
        if (!liveEvent?.id) return;
        try {
          const rows = await dispatchService.getUnits({ eventId: liveEvent.id });
          setResponders(
            rows.map((unit) => {
              let responderType: 'ambulance' | 'fire_truck' | 'security' | 'police' = 'security';
              const type = unit.type.toLowerCase();
              if (type.includes('ambulance') || type.includes('medical')) responderType = 'ambulance';
              else if (type.includes('fire')) responderType = 'fire_truck';
              else if (type.includes('police')) responderType = 'police';

              return {
                id: unit.id,
                unitId: unit.unitId,
                name: unit.name,
                type: responderType,
                location: unit.location || '',
                status:
                  unit.status === 'available'
                    ? ('available' as const)
                    : unit.status === 'offline'
                      ? ('offline' as const)
                      : ('busy' as const),
              };
            })
          );
        } catch (error) {
          // An unreadable unit list is empty and says nothing about availability.
          setResponders([]);
        }
  }, [liveEvent?.id]);

  useEffect(() => {
    if (isActive) {
      void loadUnits();
    } else {
      // Clear responders when the system is deactivated
      setResponders([]);
    }
  }, [isActive, loadUnits]);

  // Dispatching a unit is a real operator action: it assigns a responder and moves the
  // incident to INVESTIGATING in Postgres. Everything that used to follow it was theatre —
  // a random "closest" responder, a random ETA and route distance, and a setTimeout that
  // wrote status:'resolved' back to the database after 2-12 seconds. That timer meant the
  // Incident.responseTime column, which the organizer and admin dashboards present as a
  // measured average, was populated by a browser countdown. Resolution is now only ever
  // recorded when a human marks the incident resolved.
  //
  // Nearest-unit selection and a real road-distance ETA need unit coordinates and a routing
  // service; until those exist this assigns the first available unit and shows no ETA.
  /**
   * Re-reads what the server owns after a dispatch: unit availability and the
   * incident's status. Both change as a result of the call, and neither is this
   * component's to decide.
   */
  const refreshDispatchState = useCallback(async () => {
    await loadUnits();
    if (!liveEvent?.id) return;
    try {
      const rows = await incidentService.getIncidentsByEvent(liveEvent.id);
      setEmergencies((prev) =>
        prev.map((emergency) => {
          const row = rows.find((r: any) => (r._id ?? r.id) === emergency.id);
          if (!row) return emergency;
          return {
            ...emergency,
            assignedUnit: row.activeAssignments?.[0]?.unit?.name,
            status:
              row.status === 'resolved'
                ? 'resolved'
                : row.status === 'investigating'
                  ? 'dispatched'
                  : 'pending',
          };
        })
      );
    } catch {
      // The poll below re-reads on its own; a failure here changes nothing.
    }
  }, [liveEvent?.id, loadUnits]);

  const dispatchUnitToEmergency = async (emergency: Emergency) => {
    setDispatchError(null);

    try {
      // The server ranks the units that could serve this incident, nearest
      // surveyed unit first, and says whether it could rank by distance at all.
      // Picking here from a list that showed every unit as available meant
      // sending a unit already committed somewhere else.
      const { units, rankedByDistance } = await dispatchService.getUnitsForIncident(emergency.id);
      const candidate = units.find((unit) => unit.status === 'available');

      if (!candidate) {
        setDispatchError('No unit is available to send. Add or free a unit first.');
        return;
      }

      // This is the part that was missing: a DispatchAssignment row. Until now
      // dispatching moved the incident to INVESTIGATING and then edited React
      // state, so the assignment existed in one browser tab and nowhere else -
      // a refresh lost it, and the police console, which reads the real
      // assignments, never knew the unit had been sent.
      await dispatchService.dispatchUnit(emergency.id, candidate.id);

      setDispatchError(
        rankedByDistance
          ? null
          : 'Sent, but units could not be ranked by distance: this incident or the units have no surveyed position.'
      );

      // Re-read rather than assume. The server owns unit status and incident
      // status, and both change as a result of this call.
      await refreshDispatchState();
    } catch (error: any) {
      console.error('Dispatch failed:', error);
      setDispatchError(
        error?.response?.data?.message ??
          error?.message ??
          'Could not record the dispatch. The incident was left unchanged.'
      );
    }
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
      
      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <Truck className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Emergency Dispatch
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Automated emergency response system with optimal routing and real-time coordination
            </p>
          </motion.div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Phone className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{pendingEmergencies.length}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Pending</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Route className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{activeDispatches.length}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Active Dispatches</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Truck className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{availableUnits.length}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Available Units</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">-</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="glass-light rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Dispatch Control Center</h3>
                <p className="text-sm sm:text-base text-ai-gray-400">AI-powered emergency response coordination system</p>
                {!event && (
                  <p className="text-sm text-yellow-400 mt-2">⚠️ No event selected. Please setup or select an event first.</p>
                )}
                {event && eventDispatchUnits.length === 0 && (
                  <p className="text-sm text-yellow-400 mt-2">⚠️ No dispatch units configured in Event Setup. Add units in Event Setup page.</p>
                )}
              </div>
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className={`px-3 py-1 rounded-full text-xs sm:text-sm whitespace-nowrap ${
                  isActive ? 'bg-ai-white/20 text-ai-white' : 'bg-ai-gray-500/20 text-ai-gray-400'
                }`}>
                  {isActive ? '● Active' : '○ Standby'}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSystem}
                  className="flex-1 md:flex-none px-4 sm:px-6 py-3 bg-ai-white text-ai-black rounded-xl text-sm sm:text-base whitespace-nowrap hover:bg-ai-gray-300 transition-colors"
                >
                  {isActive ? 'Deactivate System' : 'Activate System'}
                </motion.button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Emergency Queue */}
            <div className="glass-light rounded-2xl p-4 sm:p-6 min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
                <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white shrink-0" />
                Emergency Queue
                {pendingEmergencies.length > 0 && (
                  <span className="bg-ai-white/20 text-ai-white px-2 py-1 rounded-full text-sm">
                    {pendingEmergencies.length}
                  </span>
                )}
              </h3>

              {/* A failed dispatch used to be visible only in the console while the UI moved
                  the card to "dispatched" anyway. Say so on screen instead. */}
              {dispatchError && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
                  {dispatchError}
                </div>
              )}

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
                      className={`border rounded-xl p-4 ${priorityColors[emergency.priority ?? 'unassessed']} ${
                        emergency.status === 'pending' ? 'border-red-500/50' : ''
                      }`}
                      onClick={() => setSelectedEmergency(emergency)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 ${emergencyColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <EmergencyIcon className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
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
                            
                            <p className="text-ai-gray-400 text-sm mb-2 break-anywhere">📍 {emergency.location}</p>
                            
                            <div className="flex flex-wrap items-center justify-between gap-2">
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
                              dispatchUnitToEmergency(emergency);
                            }}
                            className="shrink-0 px-3 py-1.5 bg-ai-white text-ai-black rounded-lg hover:bg-ai-gray-300 text-sm transition-colors"
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
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-ai-white break-anywhere">Unit: {emergency.assignedUnit}</span>
                            <span
                              className="text-ai-gray-500"
                              title="A road-distance ETA needs unit coordinates and a routing service"
                            >
                              ETA unavailable
                            </span>
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
            <div className="space-y-4 sm:space-y-6 min-w-0">
              {/* Live Map */}
              <div className="glass-light rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white shrink-0" />
                  Live Dispatch Map
                </h3>
                <div className="aspect-[4/3] sm:aspect-square bg-ai-gray-800/50 rounded-xl relative overflow-hidden">
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
                      // Emergency and responder markers used to be placed by array index
                      // (top-1/4 left-1/4, top-1/3 right-1/3 ...) and route lines by fixed
                      // percentages, so every position on this map was decorative. Neither
                      // incidents nor dispatch units carry coordinates yet, so the map states
                      // what it actually knows instead of drawing pins it cannot place.
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="bg-ai-black/70 backdrop-blur-sm rounded-xl p-4 text-center max-w-xs">
                          <p className="text-ai-gray-300 text-sm font-medium">
                            {activeDispatches.length} active dispatch{activeDispatches.length === 1 ? '' : 'es'},{' '}
                            {pendingEmergencies.length} pending
                          </p>
                          <p className="text-ai-gray-500 text-xs mt-2">
                            Positions are not plotted: incidents and dispatch units have no
                            coordinates recorded yet.
                          </p>
                        </div>
                      </div>
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
              <div className="glass-light rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex flex-wrap items-center gap-2">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white shrink-0" />
                  Responder Units
                  {eventDispatchUnits.length > 0 && isActive && (
                    <span className="text-sm text-ai-gray-400">({responders.length} from Event Setup)</span>
                  )}
                </h3>
                
                <div className="space-y-3">
                  {responders.map((responder, index) => {
                    // Find original dispatch unit info
                    const dispatchUnit = eventDispatchUnits.find(u => u.id === responder.unitId);
                    
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
                            <div className="font-medium text-white">{responder.name}</div>
                            <div className="text-xs sm:text-sm text-ai-gray-400">
                              {responder.location || 'No base location recorded'}
                            </div>
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
                        
                        <div className="flex items-center gap-3 shrink-0">
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