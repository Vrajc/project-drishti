import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, Flame, Users, Phone, CheckCircle, Clock } from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { getAnomalies, getLiveMonitoring, type Anomaly } from '../services/monitoring.service';
import { incidentService } from '../services/incident.service';
import { onRealtime } from '../lib/socket';

// A projection of a real Incident row with source=ANOMALY. Nothing on this page
// constructs one: every field below comes from the rule engine's own output.
interface Alert {
  id: string;
  type: 'fire' | 'panic' | 'medical' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  timestamp: Date;
  description: string;
  status: 'active' | 'resolved' | 'investigating';
  /**
   * The rule's own computed confidence. Null when the rule did not produce one -
   * rendered as a dash, never as a number in a plausible range.
   */
  confidence: number | null;
  ruleKey: string | null;
  cameraId: string | null;
}

/**
 * Maps a rule to the icon this page already had. A rule with no mapping falls
 * back to 'security' rather than being dropped, so a new server-side rule still
 * shows up here the day it is added.
 */
const RULE_PRESENTATION: Record<string, Alert['type']> = {
  CAMERA_OFFLINE: 'security',
  ZONE_CAPACITY_BREACH: 'panic',
  CROWD_SURGE: 'panic',
};

function toAlert(anomaly: Anomaly): Alert {
  const status =
    anomaly.status === 'RESOLVED'
      ? 'resolved'
      : anomaly.status === 'INVESTIGATING'
        ? 'investigating'
        : 'active';

  return {
    id: anomaly.id,
    type: RULE_PRESENTATION[anomaly.ruleKey ?? ''] ?? 'security',
    severity: (anomaly.severity?.toLowerCase() as Alert['severity']) ?? 'medium',
    location: anomaly.location || anomaly.camera?.name || 'Location not recorded',
    timestamp: new Date(anomaly.timestamp),
    description: anomaly.description,
    status,
    confidence: anomaly.detectionConfidence,
    ruleKey: anomaly.ruleKey,
    cameraId: anomaly.camera?.id ?? null,
  };
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Real camera health for this event, keyed by camera UUID. Empty until the
  // query answers, so a tile shows "status unknown" rather than a green dot.
  const [cameraHealth, setCameraHealth] = useState<Record<string, { status: string; lastSeenAt: string | null }>>({});

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

  // Loads the anomalies the rule engine has actually raised for this event, and
  // the real camera health behind the tiles. Called when monitoring starts and
  // whenever a live push tells us something changed.
  const refresh = React.useCallback(async () => {
    if (!event?.id) return;

    setLoading(true);
    try {
      const [anomalies, live] = await Promise.all([
        getAnomalies(event.id, 50),
        getLiveMonitoring(event.id),
      ]);

      setAlerts(anomalies.map(toAlert));

      const health: Record<string, { status: string; lastSeenAt: string | null }> = {};
      for (const camera of live.cameras) {
        health[camera.id] = { status: camera.status, lastSeenAt: camera.lastSeenAt };
      }
      setCameraHealth(health);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      setStats({
        // Cameras the health poller actually reached, not "all of them because
        // monitoring is switched on".
        camerasActive: live.cameraStatusCounts.ONLINE ?? 0,
        totalCameras: live.cameras.length,
        detectionsToday: anomalies.filter((a) => new Date(a.timestamp) >= startOfToday).length,
        // Mean over genuinely resolved incidents, in minutes. 0 means there are
        // none yet, and the tile renders that as a dash.
        avgResponseTime: live.incidents.meanResponseSeconds === null
          ? 0
          : Math.round((live.incidents.meanResponseSeconds / 60) * 10) / 10,
      });
      setLoadError(null);
    } catch (error: any) {
      // The list stays as it was and the banner says why. It never falls back
      // to generated alerts.
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  // Anomalies are raised server-side by the rule engine whether this page is
  // open or not. "Monitoring" here means subscribing to that feed, not starting
  // the detection - so nothing is invented while it is switched off.
  useEffect(() => {
    if (!isMonitoring || !event?.id) return;

    void refresh();

    const offNew = onRealtime('incident:new', (payload: any) => {
      if (payload?.source !== 'anomaly') return;
      if (payload?.eventId && payload.eventId !== event.id) return;
      void refresh();
    });
    const offUpdated = onRealtime('incident:updated', () => {
      void refresh();
    });

    // A fallback poll, so a dropped socket degrades to slower updates rather
    // than a page that silently stops changing.
    const interval = setInterval(() => void refresh(), 30000);

    return () => {
      offNew();
      offUpdated();
      clearInterval(interval);
    };
  }, [isMonitoring, event?.id, refresh]);

  const toggleMonitoring = () => {
    const next = !isMonitoring;
    setIsMonitoring(next);

    if (!next) {
      // Stopping only detaches this page from the feed. The rule engine keeps
      // running server-side, so the counters are cleared rather than frozen at
      // their last values, which would go stale without saying so.
      setAlerts([]);
      setCameraHealth({});
      setLoadError(null);
      setStats({ camerasActive: 0, totalCameras: 0, detectionsToday: 0, avgResponseTime: 0 });
    }
  };

  // Resolution is a real state change on a real incident, so it goes to the
  // server first. The list is refreshed from what the server actually stored,
  // never optimistically marked resolved on a request that failed.
  const resolveAlert = async (alertId: string) => {
    try {
      await incidentService.updateIncidentStatus(alertId, 'resolved');
      await refresh();
    } catch (error: any) {
      setLoadError(`Could not resolve this anomaly: ${error.message}`);
    }
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
      
      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <Eye className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Anomaly Detection
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Real-time multimodal detection of fires, emergencies, and safety threats using AI-powered video analysis
            </p>
          </motion.div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Eye className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{stats.camerasActive}/{stats.totalCameras}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Cameras Active</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{activeAlerts.length}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Active Alerts</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Flame className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{criticalAlerts.length}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Critical Events</div>
            </div>
            
            <div className="glass-light rounded-2xl p-4 sm:p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-ai-white" />
              <div className="text-xl sm:text-2xl font-bold text-white">{stats.avgResponseTime > 0 ? `${stats.avgResponseTime}m` : '-'}</div>
              <div className="text-xs sm:text-sm text-ai-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="glass-light rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">AI Monitoring System</h3>
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
                  className="px-4 sm:px-6 py-3 bg-ai-white text-ai-black rounded-xl text-sm sm:text-base whitespace-nowrap hover:bg-ai-gray-300 transition-colors"
                >
                  {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                </motion.button>
              </div>
            </div>

            {isMonitoring && loadError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200">
                <p className="font-medium mb-0.5">The anomaly feed could not be read.</p>
                <p className="text-xs break-anywhere">{loadError}</p>
              </div>
            )}

            {isMonitoring && !loadError && loading && alerts.length === 0 && (
              <p className="mb-4 text-sm text-ai-gray-500">Loading anomalies raised for this event...</p>
            )}

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
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white shrink-0" />
                Real-time Alerts
                {activeAlerts.length > 0 && (
                  <span className="bg-ai-white/20 text-ai-white px-2 py-1 rounded-full text-sm">
                    {activeAlerts.length} active
                  </span>
                )}
              </h3>
              
              {alerts.length === 0 ? (
                <div className="glass-light rounded-2xl p-6 sm:p-12 text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-ai-gray-700" />
                  <p className="text-ai-gray-400 text-base sm:text-lg">Monitoring active - No anomalies detected</p>
                  <p className="text-ai-gray-500 text-sm mt-2">System is analyzing camera feeds in real-time</p>
                </div>
              ) : (
                <div className="space-y-4">
                {alerts.slice(0, 6).map((alert) => {
                  const AlertIcon = alertTypes[alert.type].icon;
                  const alertColor = alertTypes[alert.type].color;
                  
                  return (
                    <div
                      key={alert.id}
                      className={`glass-light rounded-2xl p-4 sm:p-6 border-l-4 ${severityColors[alert.severity]}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 ${alertColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <AlertIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <h4 className="text-base sm:text-lg font-semibold text-white">
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
                            
                            <p className="text-sm sm:text-base text-ai-gray-400 mb-2 break-anywhere">{alert.description}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
                              <span className="text-ai-white break-anywhere">📍 {alert.location}</span>
                              <span className="text-ai-gray-500">
                                {alert.timestamp.toLocaleTimeString()}
                              </span>
                              <span className="text-ai-white">
                                {alert.confidence}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
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
            <div className="glass-light rounded-2xl p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Live Camera Feeds</h3>
              {eventCameras.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-16 h-16 text-ai-gray-700 mx-auto mb-4" />
                  <p className="text-ai-gray-400 text-base sm:text-lg">No cameras configured</p>
                  <p className="text-ai-gray-500 text-sm mt-2">Add cameras during event setup to enable monitoring</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {eventCameras.map((camera) => (
                    <div key={camera.id} className="aspect-video bg-ai-gray-800/50 rounded-lg relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-ai-gray-700 to-ai-gray-800 opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-ai-gray-500" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <div className="bg-black/50 rounded px-2 py-1 text-xs text-white max-w-[9rem] truncate">
                          {camera.name}
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <div className="bg-black/50 rounded px-2 py-1 text-xs text-ai-gray-400 max-w-[9rem] truncate">
                          📍 {camera.location}
                        </div>
                      </div>
                      {/* The camera's real state, from the health poller's last
                          probe. A camera nobody has reached shows grey, not a
                          pulsing green dot. */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            cameraHealth[camera.id]?.status === 'ONLINE'
                              ? 'bg-emerald-400 animate-pulse'
                              : cameraHealth[camera.id]?.status === 'DEGRADED'
                                ? 'bg-amber-400'
                                : cameraHealth[camera.id]?.status === 'OFFLINE'
                                  ? 'bg-red-400'
                                  : 'bg-ai-gray-500'
                          }`}
                        />
                        <span className="bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-ai-gray-300">
                          {cameraHealth[camera.id]?.status
                            ? cameraHealth[camera.id].status === 'UNKNOWN'
                              ? 'not probed'
                              : cameraHealth[camera.id].status.toLowerCase()
                            : 'status unknown'}
                        </span>
                      </div>

                      {/* An open anomaly the rule engine actually raised against
                          this camera. There is no detection box drawn: bounding
                          boxes live on the detection stream and are not stored on
                          an Incident, so there is nothing real to draw one from.
                          A rectangle over the tile would be decoration pretending
                          to be evidence. */}
                      {activeAlerts.some((alert) => alert.cameraId === camera.id) && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 border-2 border-red-400/80 rounded pointer-events-none"
                        >
                          <div className="absolute bottom-2 right-2 bg-red-500/90 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {activeAlerts.filter((a) => a.cameraId === camera.id).length} open anomaly
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