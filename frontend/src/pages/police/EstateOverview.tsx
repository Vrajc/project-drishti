import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Activity, Users, Camera as CameraIcon, RefreshCw, Loader,
  AlertTriangle, Siren, CircleDot, CircleSlash,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import * as surveillance from '../../services/surveillance.service';
import type { RegistryStats, EstateCrowd } from '../../services/surveillance.service';
import { dispatchService, type DispatchStats, type EstateIncident } from '../../services/dispatch.service';
import { STATUS_PRESENTATION } from '../surveillance/cameraStatus';
import { severityOf, RULE_EXPLANATION, relativeTime } from './incidentPresentation';

// ============================================================================
// The estate overview — what police can see across the whole jurisdiction.
//
// It answers three questions, each entirely from database reads:
//   1. Is the estate healthy?      (real: the health poller probes every camera)
//   2. What has the rule engine    (real: CAMERA_OFFLINE fires today; the crowd
//      raised?                      rules fire as soon as readings exist)
//   3. How busy is the estate?     (empty until a detector runs — and it says so)
//
// Question 3 is the honest part. There is no live detector yet, so the crowd
// panel shows how many camera zones are defined against how many have ever
// reported, and prints "no camera has reported a count yet" instead of drawing
// a chart of zeros. The moment the detector lands, the same panel fills in with
// no change to this page.
// ============================================================================

const POLL_MS = 30000;

const EstateOverview: React.FC = () => {
  const navigate = useNavigate();

  const [registry, setRegistry] = useState<RegistryStats | null>(null);
  const [dispatch, setDispatch] = useState<DispatchStats | null>(null);
  const [anomalies, setAnomalies] = useState<EstateIncident[]>([]);
  const [crowd, setCrowd] = useState<EstateCrowd | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [registryStats, dispatchStats, anomalyFeed, crowdData] = await Promise.all([
        surveillance.getRegistryStats(),
        dispatchService.getStats(),
        dispatchService.getEstateIncidents({ source: 'anomaly', take: 12 }),
        surveillance.getEstateCrowd(),
      ]);

      setRegistry(registryStats ?? null);
      setDispatch(dispatchStats);
      setAnomalies(anomalyFeed.data);
      setCrowd(crowdData ?? null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Could not load the estate overview');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const online = registry?.byStatus.ONLINE ?? 0;
  const offline = registry?.byStatus.OFFLINE ?? 0;
  const degraded = registry?.byStatus.DEGRADED ?? 0;
  const unknown = registry?.byStatus.UNKNOWN ?? 0;

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">
                  Estate Overview
                </h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                Camera health, the rules watching them, and what they have counted.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/police/dispatch')}
                className="px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Siren className="w-4 h-4" />
                Dispatch console
              </button>
              <button
                onClick={() => void load()}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </motion.div>

          {error && (
            <div className="glass-light rounded-2xl p-4 mb-4 border border-ai-white/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-ai-white shrink-0 mt-0.5" />
              <p className="text-sm text-ai-gray-200">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="glass-light rounded-2xl p-12 flex items-center justify-center">
              <Loader className="w-6 h-6 animate-spin text-ai-gray-400" />
            </div>
          ) : (
            <>
              {/* --- Estate health --------------------------------------- */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="glass-light rounded-2xl p-4">
                  <p className="text-xs text-ai-gray-400 mb-1">Cameras</p>
                  <p className="text-2xl font-bold text-ai-white">{registry?.total ?? 0}</p>
                  <p className="text-xs text-ai-gray-500 mt-1">
                    {registry?.registryOnly ?? 0} estate · {registry?.attachedToEvent ?? 0} on events
                  </p>
                </div>

                <div className="glass-light rounded-2xl p-4">
                  <p className="text-xs text-ai-gray-400 mb-1">Reachable now</p>
                  <p className="text-2xl font-bold text-ai-white">{online}</p>
                  <p className="text-xs text-ai-gray-500 mt-1">
                    {offline} offline · {degraded} degraded
                  </p>
                </div>

                <div className="glass-light rounded-2xl p-4">
                  <p className="text-xs text-ai-gray-400 mb-1">Never probed</p>
                  <p className="text-2xl font-bold text-ai-white">{unknown}</p>
                  {/* Grey, not red: nobody having asked is not the same as down. */}
                  <p className="text-xs text-ai-gray-500 mt-1">no probe has reached them yet</p>
                </div>

                <div className="glass-light rounded-2xl p-4">
                  <p className="text-xs text-ai-gray-400 mb-1">Open anomalies</p>
                  <p className="text-2xl font-bold text-ai-white">
                    {dispatch?.anomalies.openAnomalies ?? 0}
                  </p>
                  <p className="text-xs text-ai-gray-500 mt-1">
                    {dispatch?.units.available ?? 0} units available
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* --- Rule engine ------------------------------------- */}
                <div className="glass-light rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-ai-white" />
                    <h2 className="text-base font-semibold text-ai-white">Detection rules</h2>
                  </div>
                  <p className="text-xs text-ai-gray-500 mb-4">
                    Each rule fires on a measurement already in the database. A dormant rule is
                    waiting for data, not switched off.
                  </p>

                  <div className="space-y-3">
                    {dispatch?.anomalies.rules.map((rule) => (
                      <div
                        key={rule.key}
                        className="flex items-start gap-3 border border-ai-gray-800 rounded-xl p-3"
                      >
                        {rule.active ? (
                          <CircleDot className="w-4 h-4 text-ai-white shrink-0 mt-0.5" />
                        ) : (
                          <CircleSlash className="w-4 h-4 text-ai-gray-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-ai-white">
                            {rule.key.replace(/_/g, ' ').toLowerCase()}
                            <span
                              className={`ml-2 text-[11px] ${
                                rule.active ? 'text-ai-gray-300' : 'text-ai-gray-600'
                              }`}
                            >
                              {rule.active ? 'live' : 'dormant'}
                            </span>
                          </p>
                          <p className="text-[11px] text-ai-gray-500">
                            {RULE_EXPLANATION[rule.key] ?? `Requires ${rule.requires}.`}
                          </p>
                          {!rule.active && (
                            <p className="text-[11px] text-ai-gray-600 mt-0.5">
                              Waiting for {rule.requires}.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {dispatch && (
                    <p className="text-[11px] text-ai-gray-600 mt-4 pt-3 border-t border-ai-gray-800">
                      Thresholds: capacity breach at{' '}
                      {Math.round(dispatch.anomalies.thresholds.capacityBreachRatio * 100)}% of
                      declared capacity, surge at +
                      {Math.round(dispatch.anomalies.thresholds.surgeRatio * 100)}% between readings.
                    </p>
                  )}
                </div>

                {/* --- Recent anomalies -------------------------------- */}
                <div className="glass-light rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-5 h-5 text-ai-white" />
                    <h2 className="text-base font-semibold text-ai-white">Raised by rules</h2>
                  </div>
                  <p className="text-xs text-ai-gray-500 mb-4">
                    Every entry is a real incident row, not a notification.
                  </p>

                  {anomalies.length === 0 ? (
                    <p className="text-sm text-ai-gray-400">
                      No rule has fired. With {dispatch?.anomalies.camerasProbed ?? 0} camera
                      {dispatch?.anomalies.camerasProbed === 1 ? '' : 's'} probed and{' '}
                      {dispatch?.anomalies.densityReadings ?? 0} crowd reading
                      {dispatch?.anomalies.densityReadings === 1 ? '' : 's'} recorded, that is the
                      expected result.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {anomalies.map((incident) => (
                        <button
                          key={incident.id}
                          onClick={() => navigate('/police/dispatch')}
                          className="w-full text-left border border-ai-gray-800 rounded-xl p-3 hover:border-ai-gray-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                severityOf(incident.severity).chip
                              }`}
                            >
                              {severityOf(incident.severity).label}
                            </span>
                            <span
                              className="text-[11px] text-ai-gray-500 shrink-0"
                              title={new Date(incident.timestamp).toLocaleString()}
                            >
                              {relativeTime(incident.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-ai-white line-clamp-2">{incident.description}</p>
                          <p className="text-[11px] text-ai-gray-500 mt-1">
                            {incident.camera ? `${incident.camera.cameraId} · ` : ''}
                            {incident.location}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* --- Crowd ---------------------------------------------- */}
              <div className="glass-light rounded-2xl p-5 mt-4 sm:mt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5 text-ai-white" />
                  <h2 className="text-base font-semibold text-ai-white">Estate occupancy</h2>
                </div>
                <p className="text-xs text-ai-gray-500 mb-4">
                  Counted occupancy per camera zone. {crowd?.zonesReporting ?? 0} of{' '}
                  {crowd?.zonesDefined ?? 0} defined zone
                  {crowd?.zonesDefined === 1 ? '' : 's'} have reported a count.
                </p>

                {!crowd || crowd.zones.length === 0 ? (
                  // The honest empty state. Not a chart of zeros.
                  <div className="text-center py-8">
                    <CameraIcon className="w-8 h-8 text-ai-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-ai-gray-300 mb-1">
                      No counting zones are defined on estate cameras yet.
                    </p>
                    <p className="text-xs text-ai-gray-500 max-w-lg mx-auto">
                      A zone marks the region of a camera's view that gets counted. Once zones exist
                      and a detector is running, occupancy appears here and the capacity-breach and
                      surge rules begin firing against it.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {crowd.zones.map((zone) => {
                      const presentation = zone.camera
                        ? STATUS_PRESENTATION[zone.camera.status]
                        : null;

                      return (
                        <div key={zone.id} className="border border-ai-gray-800 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm text-ai-white truncate">{zone.name}</p>
                            {presentation && (
                              <span className="text-[11px] text-ai-gray-500 shrink-0">
                                {presentation.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-ai-gray-500 mb-2 truncate">
                            {zone.camera ? `${zone.camera.cameraId} · ${zone.camera.location}` : '—'}
                          </p>

                          {zone.latest ? (
                            <>
                              <p className="text-xl font-bold text-ai-white">
                                {zone.latest.peopleCount}
                                <span className="text-xs font-normal text-ai-gray-500">
                                  {' '}
                                  / {zone.maxCapacity}
                                </span>
                              </p>
                              <p className="text-[11px] text-ai-gray-500">
                                {new Date(zone.latest.timestamp).toLocaleTimeString()}
                                {zone.latest.confidence !== null &&
                                  ` · ${Math.round(zone.latest.confidence * 100)}% confidence`}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-ai-gray-500">Awaiting first count</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {lastUpdated && (
                <p className="text-xs text-ai-gray-600 pt-4">
                  Read at {lastUpdated.toLocaleTimeString()}
                  {registry?.lastHealthCheckAt
                    ? ` · last health sweep ${new Date(registry.lastHealthCheckAt).toLocaleTimeString()}`
                    : ' · no health sweep has run yet'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstateOverview;
