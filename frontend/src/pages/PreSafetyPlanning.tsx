import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, MapPin, Camera, Heart, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { analyzeSafetyPlanning } from '../services/ai.service';

const PreSafetyPlanning: React.FC = () => {
  const { event } = useEvent();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const analyzeEvent = async () => {
    if (!event) return;
    
    setIsAnalyzing(true);
    
    try {
      const result = await analyzeSafetyPlanning({
        name: event.name,
        type: event.type || 'General Event',
        expectedAttendance: event.expectedAttendance || 1000,
        venue: event.venue || 'Event Venue',
        duration: event.duration || 'Full Day',
        zones: event.zones || ['Main Area', 'Food Court', 'VIP Section']
      });

      if (result.success && result.analysis) {
        // Map AI recommendations to UI format
        const iconMap: any = {
          exit: MapPin,
          camera: Camera,
          medical: Heart,
          crowd_control: Users
        };

        const colorMap: any = {
          exit: 'bg-green-500',
          camera: 'bg-blue-500',
          medical: 'bg-red-500',
          crowd_control: 'bg-yellow-500'
        };

        const formattedRecommendations = result.analysis.recommendations.map((rec: any) => ({
          type: rec.type,
          icon: iconMap[rec.type] || Shield,
          title: rec.title,
          count: rec.count,
          description: rec.description,
          positions: rec.positions,
          priority: rec.priority,
          color: colorMap[rec.type] || 'bg-gray-500'
        }));

        setRecommendations(formattedRecommendations);
        setAnalysisComplete(true);
      }
    } catch (error: any) {
      console.error('Safety analysis error:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to analyze event safety: ${errorMessage}\n\nCheck browser console for details.`);
    } finally {
      setIsAnalyzing(false);
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
            <Shield className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              AI Pre-Safety Planning
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Intelligent placement of safety infrastructure using AI analysis of your event layout and expected crowd patterns
            </p>
          </motion.div>

          {/* Event Info Card */}
          {event && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-light rounded-2xl p-6 mb-8"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Current Event Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-ai-white">{event.name}</div>
                  <div className="text-sm text-ai-gray-400">Event Name</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{event.crowdSize.toLocaleString()}</div>
                  <div className="text-sm text-ai-gray-400">Expected Attendees</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{event.zones.length}</div>
                  <div className="text-sm text-ai-gray-400">Configured Zones</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-ai-white">{event.type}</div>
                  <div className="text-sm text-ai-gray-400">Event Type</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Analysis Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Control Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-light rounded-2xl p-6"
            >
              <h3 className="text-xl font-semibold text-white mb-6">AI Analysis Control</h3>
              
              {!analysisComplete && !isAnalyzing && (
                <div>
                  <p className="text-ai-gray-400 mb-6">
                    Our AI will analyze your event parameters to recommend optimal placement of safety infrastructure.
                  </p>
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-300">Crowd Flow Simulation</span>
                      <CheckCircle className="w-5 h-5 text-ai-white" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-300">Venue Layout Analysis</span>
                      <CheckCircle className="w-5 h-5 text-ai-white" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-300">Risk Zone Identification</span>
                      <CheckCircle className="w-5 h-5 text-ai-white" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-300">Infrastructure Optimization</span>
                      <CheckCircle className="w-5 h-5 text-ai-white" />
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={analyzeEvent}
                    disabled={isAnalyzing}
                    className="w-full px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Start AI Analysis'}
                  </motion.button>
                </div>
              )}

              {isAnalyzing && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-ai-white border-t-transparent rounded-full animate-spin"></div>
                  <h4 className="text-lg font-semibold text-white mb-2">Analyzing Event Layout</h4>
                  <p className="text-ai-gray-400">AI is processing venue data and crowd patterns...</p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center text-sm text-ai-gray-400">
                      <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse mr-2"></div>
                      Simulating crowd flow patterns
                    </div>
                    <div className="flex items-center text-sm text-ai-gray-400">
                      <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse mr-2"></div>
                      Identifying bottleneck zones
                    </div>
                    <div className="flex items-center text-sm text-ai-gray-400">
                      <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse mr-2"></div>
                      Optimizing safety placement
                    </div>
                  </div>
                </div>
              )}

              {analysisComplete && (
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-ai-white" />
                  <h4 className="text-lg font-semibold text-white mb-2">Analysis Complete</h4>
                  <p className="text-ai-gray-400 mb-4">AI has generated optimized safety recommendations for your event.</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setAnalysisComplete(false);
                      setRecommendations([]);
                    }}
                    className="w-full px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                  >
                    Run New Analysis
                  </motion.button>
                </div>
              )}
            </motion.div>

            {/* Map Visualization */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-light rounded-2xl p-6"
            >
              <h3 className="text-xl font-semibold text-white mb-6">Venue Visualization</h3>
              <div className="aspect-square bg-ai-gray-800/50 rounded-xl relative overflow-hidden">
                {/* Display uploaded venue image if available */}
                {event?.mapFile && (
                  <img 
                    src={typeof event.mapFile === 'string' ? event.mapFile : URL.createObjectURL(event.mapFile)}
                    alt="Venue Map"
                    className="w-full h-full object-cover rounded-xl"
                  />
                )}
                
                {/* Overlay for zones and recommendations */}
                <div className="absolute inset-4 border-2 border-ai-gray-600 rounded-lg">
                  {/* Stage */}
                  {!event?.mapFile && (
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-20 h-8 bg-ai-white/30 border border-ai-white rounded flex items-center justify-center text-xs text-ai-white">
                      Main Stage
                    </div>
                  )}
                  
                  {/* Zones */}
                  {!event?.mapFile && event?.zones.slice(0, 4).map((zone, index) => (
                    <div
                      key={zone}
                      className={`absolute w-16 h-12 bg-ai-gray-600/20 border border-ai-gray-600 rounded flex items-center justify-center text-xs text-ai-gray-300 ${
                        index === 0 ? 'top-16 left-4' :
                        index === 1 ? 'top-16 right-4' :
                        index === 2 ? 'bottom-16 left-4' :
                        'bottom-16 right-4'
                      }`}
                    >
                      {zone.length > 8 ? zone.substring(0, 8) + '...' : zone}
                    </div>
                  ))}

                  {/* Recommended positions */}
                  {analysisComplete && recommendations.map((rec, index) => (
                    <motion.div
                      key={rec.type}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.2 }}
                      className={`absolute w-4 h-4 bg-ai-white rounded-full shadow-lg border-2 border-ai-black ${
                        index % 4 === 0 ? 'top-8 left-8' :
                        index % 4 === 1 ? 'top-8 right-8' :
                        index % 4 === 2 ? 'bottom-8 left-8' :
                        'bottom-8 right-8'
                      }`}
                      title={rec.title}
                    />
                  ))}
                </div>
                
                {!analysisComplete && !event?.mapFile && (
                  <div className="absolute inset-0 flex items-center justify-center text-ai-gray-500">
                    Run analysis to see recommendations
                  </div>
                )}
                
                {!event?.mapFile && (
                  <div className="absolute bottom-4 left-4 right-4 bg-ai-black/70 backdrop-blur-sm rounded-lg p-3 text-center">
                    <p className="text-ai-gray-400 text-sm">
                      No venue map uploaded. Using default visualization.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Recommendations */}
          {analysisComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8"
            >
              <h3 className="text-2xl font-bold text-white mb-6">AI Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommendations.map((rec, index) => (
                  <motion.div
                    key={rec.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-light rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 bg-ai-white/20 rounded-xl flex items-center justify-center`}>
                        <rec.icon className="w-6 h-6 text-ai-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">{rec.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-ai-white">{rec.count}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            rec.priority === 'critical' ? 'bg-ai-white/20 text-ai-white' :
                            rec.priority === 'high' ? 'bg-ai-gray-600/20 text-ai-gray-300' :
                            'bg-ai-gray-600/20 text-ai-gray-300'
                          }`}>
                            {rec.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-ai-gray-400 mb-4">{rec.description}</p>
                    <div>
                      <div className="text-sm font-medium text-ai-gray-300 mb-2">Recommended Positions:</div>
                      <div className="flex flex-wrap gap-2">
                        {rec.positions.map((pos: string) => (
                          <span key={pos} className="px-2 py-1 bg-ai-gray-700/50 rounded text-xs text-ai-gray-300">
                            {pos}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreSafetyPlanning;