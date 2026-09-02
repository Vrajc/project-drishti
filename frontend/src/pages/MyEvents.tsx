import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Activity, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { getEventTiming } from '../utils/eventStatus';


const MyEvents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getUserRegisteredEvents } = useEvent();

  const registeredEvents = getUserRegisteredEvents(user?.id || '');

  const getEventStatus = (event: any): 'upcoming' | 'live' | 'completed' | 'unknown' => {
    const timing = getEventTiming(event);
    if (timing.phase === 'ended') return 'completed';
    return timing.phase;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'bg-ai-white/10 text-ai-white border-ai-white/50';
      case 'upcoming':
        return 'bg-ai-gray-600/20 text-ai-gray-300 border-ai-gray-600/50';
      case 'completed':
        return 'bg-ai-gray-800/20 text-ai-gray-500 border-ai-gray-800/50';
      default:
        return 'bg-ai-gray-800/20 text-ai-gray-500 border-ai-gray-800/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'upcoming':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
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
            className="mb-8 sm:mb-12"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                  My Events
                </h1>
                <p className="text-body text-ai-gray-400 text-sm sm:text-base lg:text-lg">
                  Track all your registered events in one place
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/explore-events')}
                className="w-full md:w-auto shrink-0 px-6 py-3 glass-medium hover:glass-strong rounded-xl transition-all duration-300 whitespace-nowrap"
              >
                Explore More Events
              </motion.button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12"
          >
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-ai-white mb-2">
                {registeredEvents.length}
              </div>
              <div className="text-caption text-xs sm:text-sm text-ai-gray-400">Total Events</div>
            </div>

            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-ai-white mb-2">
                {registeredEvents.filter(e => getEventStatus(e) === 'live').length}
              </div>
              <div className="text-caption text-xs sm:text-sm text-ai-gray-400">Live Now</div>
            </div>

            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-ai-gray-300 mb-2">
                {registeredEvents.filter(e => getEventStatus(e) === 'upcoming').length}
              </div>
              <div className="text-caption text-xs sm:text-sm text-ai-gray-400">Upcoming</div>
            </div>

            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-ai-gray-500 mb-2">
                {registeredEvents.filter(e => getEventStatus(e) === 'completed').length}
              </div>
              <div className="text-caption text-xs sm:text-sm text-ai-gray-400">Completed</div>
            </div>
          </motion.div>

          {registeredEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-light rounded-2xl p-6 sm:p-12 text-center"
            >
              <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-ai-gray-500" />
              <h3 className="text-heading text-xl font-semibold text-ai-white mb-2">No Events Yet</h3>
              <p className="text-body text-ai-gray-400 mb-6">
                You haven't registered for any events. Explore upcoming events and register now!
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/explore-events')}
                className="px-6 py-3 bg-ai-white text-ai-black rounded-xl font-medium transition-all duration-300"
              >
                Browse Events
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {registeredEvents.map((event, index) => {
                const status = getEventStatus(event);
                return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-light rounded-2xl overflow-hidden hover:scale-[1.01] transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="relative w-full md:w-64 shrink-0 h-40 sm:h-48 md:h-auto overflow-hidden bg-ai-gray-900">
                      <img
                        src={event.image || 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'}
                        alt={event.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                      {status === 'live' && (
                        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 px-3 py-1 bg-ai-white/90 backdrop-blur-sm rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 text-ai-black animate-pulse">
                          <div className="w-2 h-2 bg-ai-black rounded-full" />
                          LIVE
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 p-4 sm:p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="text-heading text-lg sm:text-xl lg:text-2xl font-bold text-ai-white break-anywhere">
                              {event.name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)} flex items-center gap-1`}>
                              {getStatusIcon(status)}
                              {status.toUpperCase()}
                            </span>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ai-gray-300 text-xs sm:text-sm">
                              <Calendar className="w-4 h-4 text-ai-gray-400 shrink-0" />
                              <span>{new Date(event.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                              <Clock className="w-4 h-4 text-ai-gray-400 sm:ml-2 shrink-0" />
                              <span>{event.time}</span>
                            </div>

                            <div className="flex items-center gap-2 text-ai-gray-300 text-xs sm:text-sm">
                              <MapPin className="w-4 h-4 text-ai-gray-400 shrink-0" />
                              <span className="break-anywhere">{event.location}</span>
                            </div>

                            <div className="inline-block px-3 py-1 glass-medium rounded-full text-caption text-ai-gray-300">
                              {event.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col xs:flex-row md:flex-col gap-3 shrink-0">
                          {status === 'live' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate('/live-monitoring')}
                              className="w-full xs:w-auto px-6 py-3 bg-ai-white text-ai-black rounded-xl text-sm sm:text-base font-medium transition-all duration-300 whitespace-nowrap"
                            >
                              View Live Updates
                            </motion.button>
                          )}

                          {status === 'upcoming' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full xs:w-auto px-4 py-2.5 glass-medium hover:glass-strong rounded-xl text-ai-white text-sm sm:text-base transition-all duration-300 whitespace-nowrap"
                            >
                              View Details
                            </motion.button>
                          )}

                          {status === 'completed' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full xs:w-auto px-4 py-2.5 glass-medium hover:glass-strong rounded-xl text-ai-white text-sm sm:text-base transition-all duration-300 whitespace-nowrap"
                            >
                              View Summary
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyEvents;
