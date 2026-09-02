import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, Activity, BarChart3, Camera as CameraIcon, Loader, AlertTriangle,
} from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import crowdAnalysisService, { CrowdDensityData, ZoneStatistics } from '../services/crowdAnalysis.service';
import * as surveillance from '../services/surveillance.service';
import type { EstateZone, RegistryCamera } from '../services/surveillance.service';
import { STATUS_PRESENTATION } from './surveillance/cameraStatus';

/**
 * Crowd flow for one event.
 *
 * This page used to ask the organizer to upload a video file. A Python analyser
 * ran over it afterwards and the results were presented as "real-time crowd
 * monitoring" - footage from whenever, analysed whenever, labelled live. The
 * upload is gone.
 *
 * What is shown now is the counting pipeline that actually exists: the cameras
 * this event has been assigned from the registry, the zones drawn on those
 * cameras, and the readings the detector recorded through them. Every number
 * below is a CrowdDensity row. Where there is no row, the page says which part
 * of the chain is missing - no cameras, no zones, or no readings - because
 * those are three different problems and none of them is "zero people".
 */
const CrowdFlowAnalysis: React.FC = () => {
  const { event } = useEvent();
  const navigate = useNavigate();

  const [crowd, setCrowd] = useState<surveillance.EstateCrowd | null>(null);
  const [cameras, setCameras] = useState<RegistryCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedZone, setSelectedZone] = useState<EstateZone | null>(null);
  const [zoneStats, setZoneStats] = useState<ZoneStatistics | null>(null);
  const [history, setHistory] = useState<CrowdDensityData[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    if (!event?.id) {
      setCrowd(null);
      setCameras([]);
      setLoading(false);
      return;
    }

    try {
      const [crowdData, cameraData] = await Promise.all([
        surveillance.getEstateCrowd(event.id),
        surveillance.getCameras({ eventId: event.id, take: 500 }),
      ]);
      setCrowd(crowdData ?? null);
      setCameras(cameraData?.cameras ?? []);
      setLoadError(null);
    } catch (error: any) {
      // An unreadable feed is reported as unreadable. Falling back to an empty
      // list here would render as an event with no cameras and no crowd.
      setCrowd(null);
      setCameras([]);
      setLoadError(error?.message ?? 'Crowd readings could not be read');
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // The detector writes one reading per zone every few seconds; polling at 15s
  // is a floor under the socket pushes the monitoring pages already receive.
  useEffect(() => {
    if (!autoRefresh || !event?.id) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, event?.id, load]);

  useEffect(() => {
    if (!event?.id || !selectedZone) {
      setZoneStats(null);
      setHistory([]);
      return;
    }

    let cancelled = false;
    setDetailError(null);

    Promise.all([
      crowdAnalysisService.getZoneStatistics(event.id, selectedZone.id),
      crowdAnalysisService.getCrowdDensity(event.id, selectedZone.id),
    ])
      .then(([stats, rows]) => {
        if (cancelled) return;
        setZoneStats(stats);
        setHistory(rows);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setZoneStats(null);
        setHistory([]);
        setDetailError(error?.message ?? 'Zone history could not be read');
      });

    return () => {
      cancelled = true;
    };
  }, [event?.id, selectedZone]);

  const zones = crowd?.zones ?? [];
  const onlineCameras = useMemo(
    () => cameras.filter((camera) => camera.status === 'ONLINE').length,
    [cameras]
  );

  const densityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-400';
    if (percentage >= 60) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const barColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  /**
   * Which link in the chain is broken, if any.
   *
   * Ordered deliberately: a missing camera is a different message from a camera
   * with no zone, which is different again from a zone nothing has counted in.
   */
  const gap = useMemo(() => {
    if (!event) return { title: 'No event selected', body: 'Choose an event to see its crowd readings.', cta: null };
    if (loadError) return null;
    if (cameras.length === 0) {
      return {
        title: 'No cameras assigned to this event',
        body:
          'Crowd flow is counted through the cameras this event borrows from the registry. Until one is assigned there is nothing to count through.',
        cta: { label: 'Assign cameras', to: '/event-cameras' },
      };
    }
    if (zones.length === 0) {
      return {
        title: 'These cameras have no counting zones',
        body:
          `${cameras.length} camera${cameras.length === 1 ? '' : 's'} assigned, but no zone has been drawn on any of them. A count is a count of people inside a zone, so nothing can be reported until one exists.`,
        cta: null,
      };
    }
    if ((crowd?.zonesReporting ?? 0) === 0) {
      return {
        title: 'No zone has reported a count yet',
        body:
          `${zones.length} zone${zones.length === 1 ? '' : 's'} defined across ${cameras.length} camera${cameras.length === 1 ? '' : 's'}, and no reading has arrived from any of them. Either the detector is not running against these cameras, or it has not published since it started. This is not an occupancy of zero.`,
        cta: null,
      };
    }
    return null;
  }, [event, loadError, cameras.length, zones.length, crowd?.zonesReporting]);

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
            className="text-center mb-8 sm:mb-12"
          >
            <Users className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Crowd Flow Analysis
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto">
              Counted live through the cameras assigned to {event?.name ?? 'this event'}
            </p>
          </motion.div>

          {/* Coverage: what the readings below are coming through */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
          >
            {[
              { label: 'Cameras assigned', value: cameras.length, icon: CameraIcon },
              { label: 'Cameras online', value: onlineCameras, icon: Activity },
              { label: 'Zones defined', value: crowd?.zonesDefined ?? 0, icon: BarChart3 },
              { label: 'Zones reporting', value: crowd?.zonesReporting ?? 0, icon: Clock },
            ].map((tile) => (
              <div key={tile.label} className="glass-light rounded-2xl p-4">
                <div className="flex items-center gap-2 text-ai-gray-400 text-xs sm:text-sm mb-2">
                  <tile.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tile.label}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-ai-white">
                  {loading && !crowd ? '—' : tile.value}
                </div>
              </div>
            ))}
          </motion.div>

          {loadError && (
            <div className="glass-light rounded-2xl p-4 sm:p-6 mb-6 border border-red-500/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-ai-white font-medium mb-1">Crowd readings could not be read</p>
                  <p className="text-ai-gray-400 text-sm break-anywhere">{loadError}</p>
                </div>
              </div>
            </div>
          )}

          {loading && !crowd && !loadError && (
            <div className="glass-light rounded-2xl p-8 sm:p-12 text-center mb-6">
              <Loader className="w-10 h-10 mx-auto mb-4 text-ai-gray-400 animate-spin" />
              <p className="text-ai-gray-400">Reading the counting pipeline…</p>
            </div>
          )}

          {!loading && gap && (
            <div className="glass-light rounded-2xl p-6 sm:p-10 text-center mb-6">
              <CameraIcon className="w-12 h-12 mx-auto mb-4 text-ai-gray-500" />
              <h3 className="text-lg sm:text-xl font-semibold text-ai-white mb-2">{gap.title}</h3>
              <p className="text-ai-gray-400 text-sm max-w-2xl mx-auto">{gap.body}</p>
              {gap.cta && (
                <button
                  onClick={() => navigate(gap.cta!.to)}
                  className="mt-5 px-5 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors text-sm font-medium"
                >
                  {gap.cta.label}
                </button>
              )}
            </div>
          )}

          {zones.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  Zone Occupancy
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-ai-gray-400">Auto-refresh (15s)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {zones.map((zone) => {
                  const reading = zone.latest;
                  const status = zone.camera ? STATUS_PRESENTATION[zone.camera.status] : null;
                  const selected = selectedZone?.id === zone.id;

                  return (
                    <motion.div
                      key={zone.id}
                      whileHover={{ scale: reading ? 1.02 : 1 }}
                      onClick={() => setSelectedZone(reading ? zone : null)}
                      className={`glass-light rounded-2xl p-5 sm:p-6 border-2 transition-all ${
                        selected ? 'border-ai-white' : 'border-transparent'
                      } ${reading ? 'cursor-pointer hover:border-ai-gray-600' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="min-w-0">
                          <h4 className="text-base sm:text-lg font-semibold text-white truncate">
                            {zone.name}
                          </h4>
                          <p className="text-xs text-ai-gray-500 truncate">
                            {zone.camera ? `${zone.camera.name} · ${zone.camera.location}` : 'Camera removed'}
                          </p>
                        </div>
                        {status && (
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded border text-[11px] ${status.pill}`}
                          >
                            {status.label}
                          </span>
                        )}
                      </div>

                      {reading ? (
                        <>
                          <div className="flex items-end justify-between gap-2 mb-3">
                            <div>
                              <div className="text-3xl font-bold text-ai-white leading-none">
                                {reading.peopleCount}
                              </div>
                              <div className="text-xs text-ai-gray-500 mt-1">
                                counted of {zone.maxCapacity} capacity
                              </div>
                            </div>
                            <div
                              className={`text-2xl sm:text-3xl font-bold ${densityColor(
                                reading.densityPercentage
                              )}`}
                            >
                              {Math.round(reading.densityPercentage)}%
                            </div>
                          </div>

                          <div className="w-full bg-ai-gray-700 rounded-full h-2.5 mb-4">
                            <motion.div
                              className={`h-2.5 rounded-full ${barColor(reading.densityPercentage)}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(reading.densityPercentage, 100)}%` }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>

                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-ai-gray-400">Last counted</span>
                              <span className="text-ai-white">
                                {new Date(reading.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-ai-gray-400">Detector confidence</span>
                              <span className="text-ai-white">
                                {reading.confidence === null
                                  ? 'Not reported'
                                  : `${Math.round(reading.confidence * 100)}%`}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        // Not a zero. Nothing has ever been counted in this zone,
                        // and a 0% bar would read as an empty zone.
                        <div className="py-4">
                          <p className="text-ai-gray-400 text-sm">No count recorded</p>
                          <p className="text-ai-gray-500 text-xs mt-1">
                            Nothing has been counted in this zone yet, which is not the same as
                            nobody being in it.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {detailError && (
            <div className="glass-light rounded-2xl p-4 mb-6 border border-red-500/40 text-sm text-ai-gray-300">
              {detailError}
            </div>
          )}

          {selectedZone && zoneStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-light rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8"
            >
              <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-ai-white shrink-0" />
                  <h3 className="text-lg sm:text-xl font-semibold text-white break-anywhere">
                    {selectedZone.name} — recorded readings
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedZone(null)}
                  aria-label="Close statistics"
                  className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                {[
                  { label: 'Average density', value: `${Math.round(zoneStats.avgDensity)}%` },
                  { label: 'Peak density', value: `${Math.round(zoneStats.maxDensity)}%` },
                  { label: 'Average people', value: Math.round(zoneStats.avgPeopleCount) },
                  { label: 'Readings recorded', value: zoneStats.dataPoints },
                ].map((tile) => (
                  <div key={tile.label} className="bg-ai-gray-800/50 rounded-xl p-4">
                    <div className="text-ai-gray-400 text-sm mb-2">{tile.label}</div>
                    <div className="text-xl sm:text-2xl font-bold text-white">{tile.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {selectedZone && history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-light rounded-2xl p-4 sm:p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-ai-white" />
                <h3 className="text-lg sm:text-xl font-semibold text-white">Density Timeline</h3>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.map((row) => (
                  <div
                    key={row._id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 p-3 bg-ai-gray-800/50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-20 sm:w-28 text-xs sm:text-sm text-ai-gray-400">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1 order-last sm:order-none w-full sm:w-auto">
                      <div className="w-full bg-ai-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${barColor(row.densityPercentage)}`}
                          style={{ width: `${Math.min(row.densityPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-12 sm:w-20 text-right">
                      <span className={`font-semibold ${densityColor(row.densityPercentage)}`}>
                        {Math.round(row.densityPercentage)}%
                      </span>
                    </div>
                    <div className="flex-shrink-0 w-auto sm:w-16 text-right text-xs sm:text-sm text-ai-gray-400">
                      {row.peopleCount} people
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrowdFlowAnalysis;
