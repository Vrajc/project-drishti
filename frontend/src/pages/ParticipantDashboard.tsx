import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import { Calendar, Eye, AlertTriangle, MapPin, Activity, Ticket, ChevronRight, Zap, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';

const ParticipantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getUserRegisteredEvents, getAllEvents } = useEvent();

  const registeredEvents = getUserRegisteredEvents(user?.id || '');
  const allEvents = getAllEvents();

  const getEventStatus = (date: string, time: string): 'upcoming' | 'live' | 'past' => {
    const now = new Date();
    
    // Parse the event date and time
    const eventDate = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    
    // Assume event duration is 8 hours (can be made configurable)
    const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
    
    // Check if current time is within event timeframe
    if (now >= eventDate && now <= eventEndTime) {
      return 'live';
    } else if (now < eventDate) {
      return 'upcoming';
    }
    return 'past';
  };

  const upcomingEvents = registeredEvents.slice(0, 2).map(event => ({
    name: event.name,
    date: event.date,
    location: event.location,
    status: getEventStatus(event.date, event.time)
  }));

  const hasLiveEvent = upcomingEvents.some(event => event.status === 'live');

  const participantFeatures = [
    {
      icon: Calendar,
      title: 'Explore Events',
      description: 'Browse and register for upcoming events in your area',
      path: '/explore-events',
      enabled: true
    },
    {
      icon: Ticket,
      title: 'My Events',
      description: 'View all your registered events and track their status',
      path: '/my-events',
      enabled: true
    },
    {
      icon: Eye,
      title: 'Live Updates',
      description: hasLiveEvent ? 'Get real-time updates and safety information during live events' : 'No live events - Register for an event first',
      path: '/live-monitoring',
      enabled: hasLiveEvent
    },
    {
      icon: AlertTriangle,
      title: 'Emergency Report',
      description: hasLiveEvent ? 'Report incidents or emergencies during events' : 'Only available during live events',
      path: '/live-monitoring',
      enabled: hasLiveEvent
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-ai-black">
      {/* Animated mesh gradient background */}
      <MeshGradient />
      
      {/* Particle layer */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ParticleHero />
      </div>
      
      {/* Interactive spotlight effects */}
      <Spotlight />
      
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 sm:mb-12"
          >
            <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 text-ai-white tracking-tight break-anywhere">
              Welcome back, <span className="text-ai-gray-300">{user?.name}</span>
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg">
              Discover events, track your registrations, and stay safe
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12"
          >
            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Registered Events</span>
                  <Ticket className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{registeredEvents.length}</div>
                <div className="text-sm text-ai-gray-500">
                  {upcomingEvents.filter(e => e.status === 'live').length} live now
                </div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Available Events</span>
                  <Calendar className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{allEvents.length}</div>
                <div className="text-sm text-ai-gray-500">Browse & register</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Safety Status</span>
                  <Activity className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">Safe</div>
                <div className="text-sm text-ai-gray-500">All systems clear</div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-light rounded-2xl p-5 sm:p-8 mb-8 sm:mb-12 border border-ai-gray-800 relative group"
            style={{
              boxShadow: '0 0 40px rgba(255, 255, 255, 0.03)'
            }}
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.05) 100%)',
                filter: 'blur(1px)'
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-semibold text-ai-white tracking-tight">Your Events</h3>
                <motion.button
                  whileHover={{ scale: 1.05, x: 4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/my-events')}
                  className="flex items-center gap-1 sm:gap-2 text-ai-white hover:text-ai-gray-300 text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="space-y-4">
                {upcomingEvents.map((event, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (0.1 * index) }}
                    whileHover={{ x: 4 }}
                    className="bg-ai-gray-900/50 rounded-xl p-4 sm:p-5 border border-ai-gray-800 hover:border-ai-gray-700 transition-all duration-300 group/event cursor-pointer"
                    onClick={() => event.status === 'live' && navigate('/live-monitoring')}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                          <h4 className="font-semibold text-ai-white text-base sm:text-lg group-hover/event:text-ai-gray-200 transition-colors break-anywhere">{event.name}</h4>
                          {event.status === 'live' && (
                            <span className="px-3 py-1 bg-ai-white/10 text-ai-white rounded-full text-xs font-medium flex items-center gap-1.5 border border-ai-gray-700">
                              <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col xs:flex-row xs:items-center gap-1.5 xs:gap-3 text-xs sm:text-sm text-ai-gray-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="hidden xs:block w-1 h-1 rounded-full bg-ai-gray-700 shrink-0" />
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {event.location}
                          </div>
                        </div>
                      </div>

                      {event.status === 'live' && (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 sm:px-5 py-2.5 bg-ai-white text-ai-black rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-white/10 transition-all flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
                        >
                          <Eye className="w-4 h-4" />
                          View Live
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Quick Actions</h2>

            <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {participantFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={feature.enabled ? { scale: 1.02, y: -4 } : {}}
                  onClick={() => feature.enabled && navigate(feature.path)}
                  className={`glass-light rounded-2xl p-4 sm:p-6 border border-ai-gray-800 transition-all duration-300 ${
                    feature.enabled 
                      ? 'cursor-pointer hover:glass-medium' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <feature.icon className={`w-7 h-7 sm:w-8 sm:h-8 mb-3 sm:mb-4 ${feature.enabled ? 'text-ai-white' : 'text-ai-gray-600'}`} />
                  <h3 className={`text-base sm:text-lg font-semibold mb-2 ${feature.enabled ? 'text-ai-white' : 'text-ai-gray-500'}`}>
                    {feature.title}
                  </h3>
                  <p className="text-sm text-ai-gray-400">
                    {feature.description}
                  </p>
                  {!feature.enabled && (
                    <div className="mt-3 px-3 py-1 bg-ai-gray-800 rounded-full text-xs text-ai-gray-500 inline-block">
                      Unavailable
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-light rounded-2xl p-5 sm:p-8 border border-ai-gray-800"
          >
            <h3 className="text-lg sm:text-xl font-semibold text-ai-white mb-4 sm:mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Safety Guidelines
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4 group">
                <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-ai-white/10 transition-colors">
                  <Zap className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="text-ai-white font-medium mb-1">Stay Alert</div>
                  <div className="text-ai-gray-400 text-sm leading-relaxed">Keep an eye on your surroundings and follow event guidelines</div>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 group">
                <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-ai-white/10 transition-colors">
                  <AlertTriangle className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="text-ai-white font-medium mb-1">Report Incidents</div>
                  <div className="text-ai-gray-400 text-sm leading-relaxed">Use the Emergency Report feature to notify organizers of any issues</div>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 group">
                <div className="w-10 h-10 bg-ai-white/5 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-ai-white/10 transition-colors">
                  <MapPin className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="text-ai-white font-medium mb-1">Know the Exits</div>
                  <div className="text-ai-gray-400 text-sm leading-relaxed">Familiarize yourself with emergency exits and assembly points</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDashboard;
