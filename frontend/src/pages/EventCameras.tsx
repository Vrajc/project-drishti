import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Camera as CameraIcon, Search, Loader, AlertTriangle, Plus, Minus, MapPin,
} from 'lucide-react';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { useEvent } from '../contexts/EventContext';
import * as surveillance from '../services/surveillance.service';
import type { RegistryCamera } from '../services/surveillance.service';
import { STATUS_PRESENTATION, formatLastSeen } from './surveillance/cameraStatus';

/**
 * Assigning estate cameras to an event.
 *
 * This is the step between defining zones and monitoring them: an event does not
 * own cameras, it borrows them from the registry. Everything shown here is a
 * real registry row, and the assignment is a real foreign key - a camera on this
 * list is genuinely the one the health poller is probing and the detector is
 * reading.
 */
const EventCameras: React.FC = () => {
  const navigate = useNavigate();
  const { event, refreshEvents } = useEvent();

  const [assigned, setAssigned] = useState<RegistryCamera[]>([]);
  const [available, setAvailable] = useState<RegistryCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!event?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [mine, free] = await Promise.all([
        surveillance.getCameras({ eventId: event.id, take: 500 }),
        // Registry-only cameras. A camera already on another event is not
        // offered here - releasing it is that event organizer's decision.
        surveillance.getCameras({ eventId: 'none', q: search || undefined, take: 500 }),
      ]);
      setAssigned(mine.cameras);
      setAvailable(free.cameras);
    } catch (error: any) {
      setAssigned([]);
      setAvailable([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [event?.id, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const change = async (camera: RegistryCamera, eventId: string | null) => {
    setBusyId(camera.id);
    setActionError(null);
    try {
      await surveillance.setCameraAssignment(camera.id, eventId);
      await load();
      // The event context caches its camera list, so it has to be re-read or the
      // monitoring pages would keep showing the old set.
      await refreshEvents();
    } catch (error: any) {
      setActionError(`${camera.cameraId}: ${error.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const surveyedCount = useMemo(
    () => assigned.filter((camera) => camera.latitude !== null).length,
    [assigned]
  );

  if (!event) {
    return (
      <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
        <MeshGradient />
        <Spotlight />
        <Navbar />
        <div className="relative z-10 pt-20 sm:pt-24 pb-8 safe-bottom">
          <div className="page-container max-w-3xl mx-auto text-center py-20">
            <CameraIcon className="w-10 h-10 text-ai-gray-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-ai-white mb-2">No event selected</h1>
            <p className="text-ai-gray-400 mb-6">
              Create or open an event before assigning cameras to it.
            </p>
            <button
              onClick={() => navigate('/event-setup')}
              className="px-5 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors text-sm font-medium"
            >
              Set up an event
            </button>
          </div>
        </div>
      </div>
    );
  }

  const row = (camera: RegistryCamera, action: 'assign' | 'release') => {
    const presentation = STATUS_PRESENTATION[camera.status];
    return (
      <li
        key={camera.id}
        className="flex items-start gap-3 p-3 rounded-lg bg-ai-gray-900/50 border border-ai-gray-800"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ai-white truncate">
            {camera.cameraId} · {camera.name}
          </p>
          <p className="text-xs text-ai-gray-500 truncate">
            {camera.site?.name ?? 'No site'} · {camera.department?.name ?? 'No department'}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className={`px-2 py-0.5 rounded border text-[10px] ${presentation.pill}`}>
              {presentation.label}
            </span>
            <span className="text-[11px] text-ai-gray-600">{formatLastSeen(camera.lastSeenAt)}</span>
            {camera.latitude === null && (
              <span className="text-[11px] text-amber-300/80 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                not surveyed
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => change(camera, action === 'assign' ? event.id : null)}
          disabled={busyId === camera.id}
          className={`shrink-0 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
            action === 'assign'
              ? 'bg-ai-white text-ai-black hover:bg-ai-gray-200'
              : 'border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-800'
          }`}
        >
          {busyId === camera.id ? (
            <Loader className="w-3.5 h-3.5 animate-spin" />
          ) : action === 'assign' ? (
            <Plus className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          {action === 'assign' ? 'Assign' : 'Release'}
        </button>
      </li>
    );
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <CameraIcon className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
              <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">
                Event Cameras
              </h1>
            </div>
            <p className="text-ai-gray-400 text-sm sm:text-base">
              Borrow cameras from the estate registry for <span className="text-ai-gray-200">{event.name}</span>.
              {assigned.length > 0 && ` ${assigned.length} assigned, ${surveyedCount} of them surveyed.`}
            </p>
          </motion.div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{actionError}</span>
            </div>
          )}

          {loadError && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200">
              <p className="font-medium mb-1">The registry could not be read.</p>
              <p className="text-xs break-anywhere">{loadError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-light rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-ai-white mb-3">
                Assigned to this event ({assigned.length})
              </h2>

              {loading ? (
                <p className="text-sm text-ai-gray-500 py-8 text-center">Loading…</p>
              ) : assigned.length === 0 ? (
                <p className="text-sm text-ai-gray-500 py-8 text-center">
                  No camera is assigned yet. Live monitoring and crowd analysis have nothing to
                  read until one is.
                </p>
              ) : (
                <ul className="space-y-2">{assigned.map((camera) => row(camera, 'release'))}</ul>
              )}
            </div>

            <div className="glass-light rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-ai-white mb-3">Available in the registry</h2>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ai-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search id, name, location or site"
                  className="w-full pl-9 pr-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white placeholder-ai-gray-500 focus:outline-none focus:border-ai-gray-400"
                />
              </div>

              {loading ? (
                <p className="text-sm text-ai-gray-500 py-8 text-center">Loading…</p>
              ) : available.length === 0 ? (
                <p className="text-sm text-ai-gray-500 py-8 text-center">
                  {search
                    ? 'No unassigned camera matches that search.'
                    : 'Every registry camera is already assigned to an event.'}
                </p>
              ) : (
                <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
                  {available.map((camera) => row(camera, 'assign'))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <button
              onClick={() => navigate('/live-monitoring')}
              className="px-5 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors text-sm font-medium"
            >
              Go to live monitoring
            </button>
            <button
              onClick={() => navigate('/organizer-dashboard')}
              className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors text-sm"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCameras;
