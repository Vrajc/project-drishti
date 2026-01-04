import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Activity, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import Navbar from '../components/Navbar';

interface RegisteredEvent {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  location: string;
  image: string;
  status: 'upcoming' | 'live' | 'completed';
}

const MyEvents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getUserRegisteredEvents } = useEvent();

  const registeredEvents = getUserRegisteredEvents(user?.id || '');

  const getEventStatus = (date: string, time: string): 'upcoming' | 'live' | 'completed' => {
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
    return 'completed';
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

      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-heading text-5xl font-bold mb-2">
                  My Events
                </h1>
                <p className="text-body text-ai-gray-400 text-lg">
                  Track all your registered events in one place
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/explore-events')}
                className="mt-4 md:mt-0 px-6 py-3 glass-medium hover:glass-strong rounded-xl transition-all duration-300"
              >
                Explore More Events
              </motion.button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            <div className="glass-light rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-ai-white mb-2">
                {registeredEvents.length}
              </div>
              <div className="text-caption text-ai-gray-400">Total Events</div>
            </div>

            <div className="glass-light rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-ai-white mb-2">
                {registeredEvents.filter(e => getEventStatus(e.date, e.time) === 'live').length}
              </div>
              <div className="text-caption text-ai-gray-400">Live Now</div>
            </div>

            <div className="glass-light rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-ai-gray-300 mb-2">
                {registeredEvents.filter(e => getEventStatus(e.date, e.time) === 'upcoming').length}
              </div>
              <div className="text-caption text-ai-gray-400">Upcoming</div>
            </div>

            <div className="glass-light rounded-2xl p-6 text-center">
              <div className="text-3xl font-bold text-ai-gray-500 mb-2">
                {registeredEvents.filter(e => getEventStatus(e.date, e.time) === 'completed').length}
              </div>
              <div className="text-caption text-ai-gray-400">Completed</div>
            </div>
          </motion.div>

          {registeredEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-light rounded-2xl p-12 text-center"
            >
              <Calendar className="w-16 h-16 mx-auto mb-4 text-ai-gray-500" />
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
            <div className="space-y-6">
              {registeredEvents.map((event, index) => {
                const status = getEventStatus(event.date, event.time);
                return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-light rounded-2xl overflow-hidden hover:scale-[1.01] transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="relative w-full md:w-64 h-48 md:h-auto overflow-hidden bg-ai-gray-900">
                      <img
                        src={event.image || 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'}
                        alt={event.name}
                        className="w-full h-full object-cover opacity-80"
                      />
                      {status === 'live' && (
                        <div className="absolute top-4 left-4 px-3 py-1 bg-ai-white/90 backdrop-blur-sm rounded-full text-sm font-medium flex items-center gap-2 text-ai-black animate-pulse">
                          <div className="w-2 h-2 bg-ai-black rounded-full" />
                          LIVE
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-heading text-2xl font-bold text-ai-white">
                              {event.name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)} flex items-center gap-1`}>
                              {getStatusIcon(status)}
                              {status.toUpperCase()}
                            </span>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-ai-gray-300 text-body">
                              <Calendar className="w-4 h-4 text-ai-gray-400" />
                              <span>{new Date(event.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                              <Clock className="w-4 h-4 text-ai-gray-400 ml-2" />
                              <span>{event.time}</span>
                            </div>

                            <div className="flex items-center gap-2 text-ai-gray-300 text-body">
                              <MapPin className="w-4 h-4 text-ai-gray-400" />
                              <span>{event.location}</span>
                            </div>

                            <div className="inline-block px-3 py-1 glass-medium rounded-full text-caption text-ai-gray-300">
                              {event.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex md:flex-col gap-3">
                          {status === 'live' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate('/live-monitoring')}
                              className="px-6 py-3 bg-ai-white text-ai-black rounded-xl font-medium transition-all duration-300 whitespace-nowrap"
                            >
                              View Live Updates
                            </motion.button>
                          )}

                          {status === 'upcoming' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-4 py-2 glass-medium hover:glass-strong rounded-xl text-ai-white transition-all duration-300 whitespace-nowrap"
                            >
                              View Details
                            </motion.button>
                          )}

                          {status === 'completed' && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-4 py-2 glass-medium hover:glass-strong rounded-xl text-ai-white transition-all duration-300 whitespace-nowrap"
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
