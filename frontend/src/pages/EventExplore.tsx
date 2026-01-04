import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Clock, Search, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import Navbar from '../components/Navbar';

interface Event {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  location: string;
  crowdSize: number;
  registered: number;
  image: string;
  organizerName: string;
  description: string;
  registeredUsers?: string[];
}

const EventExplore: React.FC = () => {
  const { user } = useAuth();
  const { getAllEvents, registerForEvent, getUserRegisteredEvents } = useEvent();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);

  const allEvents = getAllEvents();
  const userRegisteredEventIds = getUserRegisteredEvents(user?.id || '').map(e => e.id);

  const eventTypes = ['all', 'Concert', 'Conference', 'Festival', 'Exhibition', 'Sports Event', 'Parade', 'Political Rally', 'Other'];

  const filteredEvents = allEvents.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || event.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleRegister = async (eventId: string) => {
    if (user?.id && !registeringEventId) {
      setRegisteringEventId(eventId);
      try {
        await registerForEvent(eventId, user.id);
      } catch (error) {
        console.error('Registration error:', error);
      } finally {
        setRegisteringEventId(null);
      }
    }
  };

  const getCapacityColor = (registered: number, capacity: number) => {
    const percentage = (registered / capacity) * 100;
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-green-400';
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
            <h1 className="text-heading text-5xl font-bold mb-4">
              Explore Events
            </h1>
            <p className="text-body text-ai-gray-400 text-lg">
              Discover and register for amazing events happening near you
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-light rounded-2xl p-6 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ai-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by name or location..."
                  className="w-full pl-11 pr-4 py-3 bg-ai-black/50 border border-ai-gray-800 rounded-xl text-ai-white placeholder-ai-gray-500 focus:border-ai-white focus:outline-none transition-colors"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ai-gray-400" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="pl-11 pr-8 py-3 bg-ai-black/50 border border-ai-gray-800 rounded-xl text-ai-white focus:border-ai-white focus:outline-none transition-colors appearance-none cursor-pointer"
                >
                  {eventTypes.map(type => (
                    <option key={type} value={type} className="bg-ai-gray-900">
                      {type === 'all' ? 'All Types' : type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, index) => {
              const isRegistered = userRegisteredEventIds.includes(event.id);
              const registeredCount = event.registeredUsers?.length || 0;
              const capacityPercentage = (registeredCount / event.crowdSize) * 100;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-light rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300"
                >
                  <div className="relative h-48 overflow-hidden bg-ai-gray-900">
                    <img
                      src={event.image || 'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg'}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-110 opacity-80 transition-all duration-300 group-hover:opacity-100"
                    />
                    <div className="absolute top-4 right-4 px-3 py-1 glass-medium rounded-full text-sm font-medium text-ai-white">
                      {event.type}
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-heading text-xl font-bold text-ai-white mb-2 line-clamp-1">
                      {event.name}
                    </h3>

                    <p className="text-body text-ai-gray-400 text-sm mb-4 line-clamp-2">
                      {event.description || 'No description available'}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-ai-gray-300">
                        <Calendar className="w-4 h-4 text-ai-gray-400" />
                        <span>{new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</span>
                        <Clock className="w-4 h-4 text-ai-gray-400 ml-2" />
                        <span>{event.time}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-ai-gray-300">
                        <MapPin className="w-4 h-4 text-ai-gray-400" />
                        <span className="line-clamp-1">{event.location}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-ai-gray-400" />
                        <span className={getCapacityColor(registeredCount, event.crowdSize)}>
                          {registeredCount.toLocaleString()} / {event.crowdSize.toLocaleString()} registered
                        </span>
                      </div>

                      <div className="w-full bg-ai-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            capacityPercentage >= 90 ? 'bg-ai-gray-300' :
                            capacityPercentage >= 70 ? 'bg-ai-gray-400' :
                            'bg-ai-gray-500'
                          }`}
                          style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-caption text-ai-gray-500 mb-4">
                      Organized by {event.organizerName || 'Unknown'}
                    </div>

                    <motion.button
                      whileHover={{ scale: isRegistered || registeringEventId === event.id ? 1 : 1.02 }}
                      whileTap={{ scale: isRegistered || registeringEventId === event.id ? 1 : 0.98 }}
                      onClick={() => handleRegister(event.id)}
                      disabled={isRegistered || registeringEventId === event.id || capacityPercentage >= 100}
                      className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 ${
                        isRegistered
                          ? 'bg-ai-white text-ai-black cursor-default'
                          : registeringEventId === event.id
                          ? 'bg-ai-gray-700 text-ai-gray-400 cursor-wait'
                          : capacityPercentage >= 100
                          ? 'bg-ai-gray-800 text-ai-gray-500 cursor-not-allowed'
                          : 'glass-medium hover:glass-strong text-ai-white'
                      }`}
                    >
                      {isRegistered ? 'Registered ✓' :
                       registeringEventId === event.id ? 'Registering...' :
                       capacityPercentage >= 100 ? 'Event Full' : 'Register'}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredEvents.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-ai-gray-400 text-lg">No events found matching your criteria</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventExplore;
