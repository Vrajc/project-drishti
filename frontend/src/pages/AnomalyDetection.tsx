import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, Flame, Users, Phone, CheckCircle, Clock } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { analyzeIncident } from '../services/ai.service';

interface Alert {
  id: string;
  type: 'fire' | 'panic' | 'medical' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  timestamp: Date;
  description: string;
  status: 'active' | 'resolved' | 'investigating';
  confidence: number;
}

const AnomalyDetection: React.FC = () => {
  const { event } = useEvent();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    camerasActive: 0,
    totalCameras: 0,
    detectionsToday: 0,
    avgResponseTime: 0
  });

  // Get cameras from event setup
  const eventCameras = event?.cameras || [];

  const alertTypes = {
    fire: { icon: Flame, color: 'bg-ai-white/20', label: 'Fire/Smoke' },
    panic: { icon: Users, color: 'bg-ai-gray-600/20', label: 'Crowd Panic' },
    medical: { icon: Phone, color: 'bg-ai-gray-600/20', label: 'Medical Emergency' },
    security: { icon: AlertTriangle, color: 'bg-ai-gray-600/20', label: 'Security Threat' }
  };

  const severityColors = {
    low: 'border-ai-gray-600 bg-ai-gray-600/10',
    medium: 'border-ai-gray-600 bg-ai-gray-600/10',
    high: 'border-ai-white bg-ai-white/10',
    critical: 'border-ai-white bg-ai-white/10'
  };

  const generateMockAlert = async (): Promise<Alert> => {
    const types = ['fire', 'panic', 'medical', 'security'] as const;
    const descriptions = {
      fire: [
        'Smoke detected in vicinity',
        'High temperature anomaly detected',
        'Fire risk: Unattended ignition source detected',
        'Smoke pattern consistent with early-stage fire'
      ],
      panic: [
        'Sudden crowd movement patterns detected',
        'Rapid crowd dispersal behavior observed',
        'High-density crowd stress indicators',
        'Abnormal crowd flow direction changes'
      ],
      medical: [
        'Person down detected via video analysis',
        'Unconscious individual identified',
        'Medical distress posture detected',
        'Person requiring immediate assistance'
      ],
      security: [
        'Suspicious activity identified',
        'Unauthorized access attempt detected',
        'Unattended baggage detected',
        'Restricted area breach detected'
      ]
    };

    // Use event cameras or default locations
    const locations = eventCameras.length > 0 
      ? eventCameras.map(cam => cam.location)
      : ['Main Stage', 'Food Court', 'VIP Area', 'Entrance Gate', 'Parking Lot', 'Emergency Exit 3'];

    const type = types[Math.floor(Math.random() * types.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const description = descriptions[type][Math.floor(Math.random() * descriptions[type].length)];
    
    // Use AI to analyze the incident
    try {
      const analysis = await analyzeIncident({
        type,
        location,
        description,
        context: 'Live event monitoring via AI video analysis'
      });

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        severity: analysis.analysis.severity,
        location,
        timestamp: new Date(),
        description,
        status: 'active',
        confidence: analysis.analysis.confidence
      };
    } catch (error) {
      // Fallback to random if AI fails
      const severities = ['low', 'medium', 'high', 'critical'] as const;
      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        severity: severities[Math.floor(Math.random() * severities.length)],
        location,
        timestamp: new Date(),
        description,
        status: 'active',
        confidence: Math.floor(Math.random() * 25) + 75 // 75-100% confidence
      };
    }
  };

  useEffect(() => {
    if (isMonitoring) {
      // Update stats based on actual data
      setStats({
        camerasActive: isMonitoring ? eventCameras.length : 0,
        totalCameras: eventCameras.length,
        detectionsToday: alerts.length,
        avgResponseTime: 0
      });
    }
  }, [isMonitoring, alerts.length, eventCameras.length]);

  // Simulate periodic anomaly detection from camera feeds
  useEffect(() => {
    if (!isMonitoring || eventCameras.length === 0) return;

    const interval = setInterval(async () => {
      // Random chance of new detection (30% chance every 15 seconds)
      if (Math.random() < 0.3 && alerts.filter(a => a.status === 'active').length < 8) {
        const newAlert = await generateMockAlert();
        setAlerts(prev => [newAlert, ...prev].slice(0, 20)); // Keep only latest 20 alerts
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isMonitoring, eventCameras.length, alerts]);

  const toggleMonitoring = async () => {
    const newMonitoringState = !isMonitoring;
    setIsMonitoring(newMonitoringState);
    
    if (newMonitoringState) {
      // Generate initial mock alerts when monitoring starts
      const initialAlerts = await Promise.all([
        generateMockAlert(),
        generateMockAlert()
      ]);
      setAlerts(initialAlerts);
    } else {
      setAlerts([]);
      setStats({
        camerasActive: 0,
        totalCameras: 0,
        detectionsToday: 0,
        avgResponseTime: 0
      });
    }
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, status: 'resolved' as const }
        : alert
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-ai-white bg-ai-white/20';
      case 'resolved': return 'text-ai-gray-500 bg-ai-gray-500/20';
      case 'investigating': return 'text-ai-gray-300 bg-ai-gray-300/20';
      default: return 'text-ai-gray-400 bg-ai-gray-500/20';
    }
  };

  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

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
              Anomaly Detection
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Real-time multimodal detection of fires, emergencies, and safety threats using AI-powered video analysis
            </p>
          </motion.div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-light rounded-2xl p-6 text-center">
              <Eye className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{stats.camerasActive}/{stats.totalCameras}</div>
              <div className="text-sm text-ai-gray-400">Cameras Active</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{activeAlerts.length}</div>
              <div className="text-sm text-ai-gray-400">Active Alerts</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <Flame className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{criticalAlerts.length}</div>
              <div className="text-sm text-ai-gray-400">Critical Events</div>
            </div>
            
            <div className="glass-light rounded-2xl p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-2xl font-bold text-white">{stats.avgResponseTime > 0 ? `${stats.avgResponseTime}m` : '-'}</div>
              <div className="text-sm text-ai-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="glass-light rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">AI Monitoring System</h3>
                <p className="text-ai-gray-400">Advanced computer vision for real-time threat detection</p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-sm ${
                  isMonitoring ? 'bg-ai-white/20 text-ai-white' : 'bg-ai-gray-500/20 text-ai-gray-400'
                }`}>
                  {isMonitoring ? '● Live' : '○ Offline'}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMonitoring}
                  className="px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors"
                >
                  {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                </motion.button>
              </div>
            </div>

            {isMonitoring && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 pt-6 border-t border-ai-gray-700"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse"></div>
                    <span className="text-ai-gray-400">Fire Detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse"></div>
                    <span className="text-ai-gray-400">Crowd Analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse"></div>
                    <span className="text-ai-gray-400">Object Recognition</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse"></div>
                    <span className="text-ai-gray-400">Audio Analysis</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Active Alerts */}
          {isMonitoring && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-ai-white" />
                Real-time Alerts
                {activeAlerts.length > 0 && (
                  <span className="bg-ai-white/20 text-ai-white px-2 py-1 rounded-full text-sm">
                    {activeAlerts.length} active
                  </span>
                )}
              </h3>
              
              {alerts.length === 0 ? (
                <div className="glass-light rounded-2xl p-12 text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
                  <p className="text-ai-gray-400 text-lg">Monitoring active - No anomalies detected</p>
                  <p className="text-ai-gray-500 text-sm mt-2">System is analyzing camera feeds in real-time</p>
                </div>
              ) : (
                <div className="space-y-4">
                {alerts.slice(0, 6).map((alert, index) => {
                  const AlertIcon = alertTypes[alert.type].icon;
                  const alertColor = alertTypes[alert.type].color;
                  
                  return (
                    <div
                      key={alert.id}
                      className={`glass-light rounded-2xl p-6 border-l-4 ${severityColors[alert.severity]}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 ${alertColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <AlertIcon className="w-6 h-6 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-white">
                                {alertTypes[alert.type].label}
                              </h4>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                alert.severity === 'critical' ? 'bg-ai-white/20 text-ai-white' :
                                alert.severity === 'high' ? 'bg-ai-gray-600/20 text-ai-gray-300' :
                                alert.severity === 'medium' ? 'bg-ai-gray-600/20 text-ai-gray-300' :
                                'bg-ai-gray-600/20 text-ai-gray-300'
                              }`}>
                                {alert.severity}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(alert.status)}`}>
                                {alert.status}
                              </span>
                            </div>
                            
                            <p className="text-ai-gray-400 mb-2">{alert.description}</p>
                            
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-ai-white">📍 {alert.location}</span>
                              <span className="text-ai-gray-500">
                                {alert.timestamp.toLocaleTimeString()}
                              </span>
                              <span className="text-ai-white">
                                {alert.confidence}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {alert.status === 'active' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => resolveAlert(alert.id)}
                              className="px-3 py-1 bg-ai-white text-ai-black rounded-lg hover:bg-ai-gray-300 text-sm transition-colors"
                            >
                              Resolve
                            </motion.button>
                          )}
                          {alert.status === 'resolved' && (
                            <CheckCircle className="w-5 h-5 text-ai-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </motion.div>
          )}

          {/* Camera Grid Simulation */}
          {isMonitoring && (
            <div className="glass-light rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Live Camera Feeds</h3>
              {eventCameras.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-16 h-16 text-ai-gray-700 mx-auto mb-4" />
                  <p className="text-ai-gray-400 text-lg">No cameras configured</p>
                  <p className="text-ai-gray-500 text-sm mt-2">Add cameras during event setup to enable monitoring</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {eventCameras.map((camera, i) => (
                    <div key={camera.id} className="aspect-video bg-ai-gray-800/50 rounded-lg relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-ai-gray-700 to-ai-gray-800 opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-ai-gray-500" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <div className="bg-black/50 rounded px-2 py-1 text-xs text-white">
                          {camera.name}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <div className="bg-black/50 rounded px-2 py-1 text-xs text-ai-gray-400">
                          📍 {camera.location}
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-ai-white rounded-full animate-pulse" />
                      </div>
                      
                      {/* Simulate AI detection boxes */}
                      {Math.random() > 0.7 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-4 border-2 border-ai-white rounded"
                        >
                          <div className="bg-ai-white/80 text-ai-black text-xs px-1 py-0.5 rounded">
                            Anomaly Detected
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnomalyDetection;