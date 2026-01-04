import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import { Calendar, Shield, Users, Eye, Brain, FileText, AlertTriangle, Truck, Activity, TrendingUp } from 'lucide-react';
import FloatingElements from '../components/FloatingElements';
import FeatureCard from '../components/FeatureCard';
import Navbar from '../components/Navbar';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import ParticleHero from '../components/ParticleHero';
import { incidentService } from '../services/incident.service';

const OrganizerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { event, getEventsByOrganizer } = useEvent();
  const [activeIncidents, setActiveIncidents] = React.useState(0);
  const [averageResponseTime, setAverageResponseTime] = React.useState<number | null>(null);

  // Get organizer's events using email
  const organizerEvents = getEventsByOrganizer(user?.email || '');

  // Check if an event is currently live
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

  // Get live and upcoming events
  const liveEvents = organizerEvents.filter(e => getEventStatus(e.date, e.time) === 'live');
  const hasLiveEvent = liveEvents.length > 0;

  // Load active incidents count and average response time for live events
  React.useEffect(() => {
    if (!hasLiveEvent || liveEvents.length === 0) {
      setActiveIncidents(0);
      setAverageResponseTime(null);
      return;
    }

    const loadIncidents = async () => {
      let totalActiveIncidents = 0;
      let resolvedIncidents: number[] = [];
      
      for (const liveEvent of liveEvents) {
        try {
          const incidents = await incidentService.getIncidentsByEvent(liveEvent.id);
          const activeCount = incidents.filter(inc => inc.status !== 'resolved').length;
          totalActiveIncidents += activeCount;
          
          // Collect response times for resolved incidents
          incidents.forEach(inc => {
            if (inc.status === 'resolved' && inc.responseTime) {
              resolvedIncidents.push(inc.responseTime);
            }
          });
        } catch (error) {
          console.error('Error loading incidents:', error);
        }
      }
      
      setActiveIncidents(totalActiveIncidents);
      
      // Calculate average response time
      if (resolvedIncidents.length > 0) {
        const avgTime = resolvedIncidents.reduce((a, b) => a + b, 0) / resolvedIncidents.length;
        setAverageResponseTime(avgTime);
      } else {
        setAverageResponseTime(null);
      }
    };

    loadIncidents();
    const intervalId = setInterval(loadIncidents, 3000);
    return () => clearInterval(intervalId);
  }, [hasLiveEvent, liveEvents.length]);

  const organizerFeatures = [
    {
      icon: Shield,
      title: 'AI Pre-Safety Planning',
      description: 'Intelligent placement of safety infrastructure using AI analysis',
      path: '/pre-safety-planning',
      enabled: true,
      badge: null
    },
    {
      icon: Eye,
      title: 'Live Safety Monitoring',
      description: hasLiveEvent ? 'Real-time dashboard for comprehensive event oversight' : 'Start an event to enable live monitoring',
      path: '/live-monitoring',
      enabled: hasLiveEvent,
      badge: hasLiveEvent ? 'LIVE' : null
    },
    {
      icon: Users,
      title: 'Crowd Flow Analysis',
      description: hasLiveEvent ? 'Predict bottlenecks and manage crowd density effectively' : 'Available during live events',
      path: '/crowd-flow-analysis',
      enabled: hasLiveEvent,
      badge: hasLiveEvent ? 'LIVE' : null
    },
    {
      icon: AlertTriangle,
      title: 'Anomaly Detection',
      description: hasLiveEvent ? 'AI-powered detection of emergencies and safety threats' : 'Available during live events',
      path: '/anomaly-detection',
      enabled: hasLiveEvent,
      badge: hasLiveEvent ? 'LIVE' : null
    },
    {
      icon: Truck,
      title: 'Emergency Dispatch',
      description: hasLiveEvent ? 'Automated emergency response with optimal routing' : 'Available during live events',
      path: '/emergency-dispatch',
      enabled: hasLiveEvent,
      badge: hasLiveEvent ? 'LIVE' : null
    },
    {
      icon: Brain,
      title: 'AI Safety Assistant',
      description: 'Conversational insights about event safety status',
      path: '/ai-summaries',
      enabled: true,
      badge: null
    },
    {
      icon: FileText,
      title: 'Post-Event Reports',
      description: 'Comprehensive safety analysis and recommendations',
      path: '/post-event-reports',
      enabled: true,
      badge: null
    },
    {
      icon: Calendar,
      title: 'Setup New Event',
      description: 'Configure a new event for safety management',
      path: '/event-setup',
      enabled: true,
      badge: null
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

      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-5xl font-bold mb-3 text-ai-white tracking-tight">
              Welcome back, <span className="text-ai-gray-300">{user?.name}</span>
            </h1>
            <p className="text-ai-gray-400 text-lg">
              Manage your events with AI-powered safety features
            </p>
          </motion.div>

          {event && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-light rounded-2xl p-8 mb-8 border border-ai-gray-800 relative group"
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-ai-white tracking-wide">Current Event</h3>
                  {getEventStatus(event.date, event.time) === 'live' && (
                    <span className="px-4 py-2 bg-ai-white/10 text-ai-white rounded-full text-sm font-medium flex items-center gap-2 border border-ai-gray-700">
                      <div className="w-2.5 h-2.5 bg-ai-white rounded-full animate-pulse" />
                      LIVE NOW
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-ai-white mb-1">{event.name}</div>
                    <div className="text-sm text-ai-gray-400">Event Name</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-ai-white mb-1">{event.crowdSize.toLocaleString()}</div>
                    <div className="text-sm text-ai-gray-400">Expected Attendees</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-ai-white mb-1">{event.zones.length}</div>
                    <div className="text-sm text-ai-gray-400">Configured Zones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-ai-white mb-1">{new Date(event.date).toLocaleDateString()}</div>
                    <div className="text-sm text-ai-gray-400">Event Date</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          >
            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Safety Score</span>
                  <Shield className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">-</div>
                <div className="text-sm text-ai-gray-500">N/A</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Active Alerts</span>
                  <AlertTriangle className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-ai-white mb-1">{activeIncidents}</div>
                  {activeIncidents > 0 && (
                    <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse" />
                  )}
                </div>
                <div className="text-sm text-ai-gray-500">{activeIncidents > 0 ? 'Needs attention' : 'None'}</div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -4 }}
              className="glass-light rounded-2xl p-6 border border-ai-gray-800 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ai-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Response Time</span>
                  <Truck className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">
                  {averageResponseTime !== null 
                    ? `${Math.floor(averageResponseTime / 60)}m ${Math.round(averageResponseTime % 60)}s`
                    : '-'
                  }
                </div>
                <div className="text-sm text-ai-gray-500">
                  {averageResponseTime !== null ? 'Average response' : 'N/A'}
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
                  <span className="text-sm font-medium text-ai-gray-400 tracking-wide">Total Events</span>
                  <Calendar className="w-5 h-5 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                </div>
                <div className="text-3xl font-bold text-ai-white mb-1">{organizerEvents.length}</div>
                <div className="text-sm text-ai-gray-500">{liveEvents.length} live now</div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Safety Management Tools</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {organizerFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={feature.enabled ? { scale: 1.02, y: -4 } : {}}
                  onClick={() => feature.enabled && navigate(feature.path)}
                  className={`glass-light rounded-2xl p-6 border border-ai-gray-800 transition-all duration-300 relative ${
                    feature.enabled 
                      ? 'cursor-pointer hover:glass-medium' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {feature.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-1 bg-ai-white/10 text-ai-white rounded-full text-xs font-medium flex items-center gap-1.5 border border-ai-gray-700">
                        <div className="w-1.5 h-1.5 bg-ai-white rounded-full animate-pulse" />
                        {feature.badge}
                      </span>
                    </div>
                  )}
                  <feature.icon className={`w-8 h-8 mb-4 ${feature.enabled ? 'text-ai-white' : 'text-ai-gray-600'}`} />
                  <h3 className={`text-lg font-semibold mb-2 ${feature.enabled ? 'text-ai-white' : 'text-ai-gray-500'}`}>
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
            className="glass-light rounded-2xl p-8 border border-ai-gray-800"
          >
            <h3 className="text-xl font-semibold text-ai-white mb-6 tracking-wide">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/live-monitoring')}
                className="p-6 bg-ai-gray-900/50 hover:bg-ai-gray-800/50 border border-ai-gray-800 hover:border-ai-gray-700 rounded-xl transition-all group"
              >
                <Eye className="w-7 h-7 mx-auto mb-3 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                <div className="font-semibold text-ai-white group-hover:text-ai-gray-200">View Live Dashboard</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/pre-safety-planning')}
                className="p-6 bg-ai-gray-900/50 hover:bg-ai-gray-800/50 border border-ai-gray-800 hover:border-ai-gray-700 rounded-xl transition-all group"
              >
                <Shield className="w-7 h-7 mx-auto mb-3 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                <div className="font-semibold text-ai-white group-hover:text-ai-gray-200">AI Safety Planning</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/event-setup')}
                className="p-6 bg-ai-gray-900/50 hover:bg-ai-gray-800/50 border border-ai-gray-800 hover:border-ai-gray-700 rounded-xl transition-all group"
              >
                <Calendar className="w-7 h-7 mx-auto mb-3 text-ai-gray-400 group-hover:text-ai-white transition-colors" />
                <div className="font-semibold text-ai-white group-hover:text-ai-gray-200">Setup New Event</div>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;
