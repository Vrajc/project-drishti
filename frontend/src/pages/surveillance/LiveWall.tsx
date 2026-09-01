import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import {
  Video, VideoOff, List, Map as MapIcon, Loader, AlertTriangle, RefreshCw, X, Radio,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import * as surveillance from '../../services/surveillance.service';
import type {
  RegistryCamera, Department, StreamEndpoints, HealthPollerStatus, SweepSummary,
} from '../../services/surveillance.service';
import { STATUS_PRESENTATION, formatLastSeen } from './cameraStatus';

// A 5x5 wall. Anything beyond twenty-five is a page away rather than a
// twenty-fifth of a browser tab's decoding budget.
const GRID_SIZE = 25;

/**
 * What the tile knows about its own playback, as observed from the video
 * element rather than assumed from having called play(). "Live" on this page
 * means pixels are arriving now, which is a different claim from the registry's
 * status, which means the last probe reached the camera.
 */
type Playback =
  | { state: 'resolving' }
  | { state: 'unplayable'; reason: string }
  | { state: 'connecting'; url: string }
  | { state: 'playing'; url: string }
  | { state: 'stalled'; url: string }
  | { state: 'failed'; url: string; reason: string };

interface TileProps {
  camera: RegistryCamera;
  active: boolean;
  onExpand: (camera: RegistryCamera) => void;
  onPlaybackChange: (id: string, playback: Playback) => void;
}

function useHlsPlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  url: string | null,
  active: boolean,
  onState: (playback: Playback) => void
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !active) return;

    let hls: Hls | null = null;
    let cancelled = false;

    const report = (playback: Playback) => {
      if (!cancelled) onState(playback);
    };

    report({ state: 'connecting', url });

    const onPlaying = () => report({ state: 'playing', url });
    const onWaiting = () => report({ state: 'stalled', url });
    const onMediaError = () =>
      report({ state: 'failed', url, reason: 'The browser could not decode this stream' });

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onMediaError);

    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 8,
        // A wall of twenty-five tiles should recover quietly from a blip rather
        // than hammering a stream server that is already struggling.
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 2,
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        // The message is the library's own, not a rewrite: an operator chasing a
        // dead feed needs the actual failure.
        report({
          state: 'failed',
          url,
          reason: data.details ? `${data.type}: ${data.details}` : String(data.type),
        });
        hls?.destroy();
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else {
      report({ state: 'failed', url, reason: 'This browser cannot play HLS' });
      return;
    }

    void video.play().catch(() => {
      // Autoplay refusal is not a stream failure; the expanded view has controls.
    });

    return () => {
      cancelled = true;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onMediaError);
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [videoRef, url, active, onState]);
}

const CameraTile: React.FC<TileProps> = ({ camera, active, onExpand, onPlaybackChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [endpoints, setEndpoints] = useState<StreamEndpoints | null>(null);
  const [playback, setPlayback] = useState<Playback>({ state: 'resolving' });

  const report = useCallback(
    (next: Playback) => {
      setPlayback(next);
      onPlaybackChange(camera.id, next);
    },
    [camera.id, onPlaybackChange]
  );

  useEffect(() => {
    let cancelled = false;

    surveillance
      .getCameraStream(camera.id)
      .then((result) => {
        if (cancelled) return;
        setEndpoints(result);
        if (!result.playable) {
          report({ state: 'unplayable', reason: result.reason ?? 'No playable URL' });
        }
      })
      .catch((error: any) => {
        if (!cancelled) report({ state: 'unplayable', reason: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [camera.id, report]);

  useHlsPlayer(videoRef, endpoints?.playable ? endpoints.hlsUrl : null, active, report);

  const presentation = STATUS_PRESENTATION[camera.status];
  const isLive = playback.state === 'playing';

  return (
    <button
      type="button"
      onClick={() => onExpand(camera)}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-ai-gray-900 border border-ai-gray-800 hover:border-ai-gray-600 transition-colors text-left"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${isLive ? 'opacity-100' : 'opacity-0'}`}
      />

      {!isLive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {playback.state === 'resolving' || playback.state === 'connecting' ? (
            <>
              <Loader className="w-5 h-5 animate-spin text-ai-gray-500 mb-1.5" />
              <span className="text-[11px] text-ai-gray-500">
                {playback.state === 'resolving' ? 'Resolving stream…' : 'Connecting…'}
              </span>
            </>
          ) : playback.state === 'stalled' ? (
            <>
              <Loader className="w-5 h-5 animate-spin text-amber-400/70 mb-1.5" />
              <span className="text-[11px] text-amber-300/80">Buffering</span>
            </>
          ) : (
            <>
              <VideoOff className="w-5 h-5 text-ai-gray-600 mb-1.5" />
              <span className="text-[11px] text-ai-gray-500 line-clamp-3 break-anywhere">
                {playback.state === 'unplayable' || playback.state === 'failed'
                  ? playback.reason
                  : 'Not playing'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Identity and the two different truths: is it playing right now, and
          what did the last probe find. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ai-white truncate">{camera.cameraId}</p>
          <p className="text-[10px] text-ai-gray-400 truncate">{camera.name}</p>
        </div>
        {isLive && (
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/85 text-[9px] font-bold tracking-wide text-white">
            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className={`flex items-center gap-1 text-[10px] ${presentation.pill} px-1.5 py-0.5 rounded border`}>
          <span className={`w-1 h-1 rounded-full ${presentation.dot}`} />
          {presentation.label}
        </span>
        <span className="text-[9px] text-ai-gray-500 truncate">{formatLastSeen(camera.lastSeenAt)}</span>
      </div>
    </button>
  );
};

const LiveWall: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canProbe = user?.role === 'admin' || user?.role === 'police';

  const [cameras, setCameras] = useState<RegistryCamera[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [poller, setPoller] = useState<HealthPollerStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);

  const [playbackById, setPlaybackById] = useState<Record<string, Playback>>({});
  const [expanded, setExpanded] = useState<RegistryCamera | null>(null);

  const [probing, setProbing] = useState(false);
  const [lastSweep, setLastSweep] = useState<SweepSummary | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, deptRows, health] = await Promise.all([
        surveillance.getCameras({
          departmentId: departmentFilter || undefined,
          skip: page * GRID_SIZE,
          take: GRID_SIZE,
        }),
        surveillance.getDepartments(),
        surveillance.getHealthStatus(),
      ]);
      setCameras(result.cameras);
      setTotal(result.total);
      setDepartments(deptRows);
      setPoller(health);
      if (health.lastSweep) setLastSweep(health.lastSweep);
    } catch (error: any) {
      setCameras([]);
      setTotal(0);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  // The registry's status changes underneath the wall when the poller runs, so
  // refresh the rows on the poller's own cadence. The video keeps playing; only
  // the badges move.
  useEffect(() => {
    if (!poller?.enabled) return;
    const interval = setInterval(() => {
      surveillance
        .getCameras({
          departmentId: departmentFilter || undefined,
          skip: page * GRID_SIZE,
          take: GRID_SIZE,
        })
        .then((result) => {
          setCameras(result.cameras);
          setTotal(result.total);
        })
        .catch((error: any) => setLoadError(error.message));
    }, Math.max(poller.intervalSeconds, 10) * 1000);

    return () => clearInterval(interval);
  }, [poller?.enabled, poller?.intervalSeconds, departmentFilter, page]);

  const onPlaybackChange = useCallback((id: string, playback: Playback) => {
    setPlaybackById((previous) => ({ ...previous, [id]: playback }));
  }, []);

  // Counted from the tiles' observed state, not from how many we asked to play.
  const livePlaying = useMemo(
    () => cameras.filter((camera) => playbackById[camera.id]?.state === 'playing').length,
    [cameras, playbackById]
  );

  const probeNow = async () => {
    setProbing(true);
    setProbeError(null);
    try {
      const summary = await surveillance.runHealthCheck();
      setLastSweep(summary);
      await load();
    } catch (error: any) {
      setProbeError(error.message);
    } finally {
      setProbing(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / GRID_SIZE));

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
                <Video className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">Live Wall</h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                {loading
                  ? 'Loading the wall…'
                  : `${livePlaying} of ${cameras.length} tiles on this page are playing now.`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/surveillance/cameras')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <List className="w-4 h-4" />
                Registry
              </button>
              <button
                onClick={() => navigate('/surveillance/map')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <MapIcon className="w-4 h-4" />
                Map
              </button>
              {canProbe && (
                <button
                  onClick={probeNow}
                  disabled={probing}
                  className="px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${probing ? 'animate-spin' : ''}`} />
                  Probe now
                </button>
              )}
            </div>
          </motion.div>

          {/* What the poller is actually doing, stated rather than implied. */}
          <div className="glass-light rounded-2xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white focus:outline-none focus:border-ai-gray-400"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.cameraCount})</option>
              ))}
            </select>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-ai-gray-300">
              <input
                type="checkbox"
                checked={playing}
                onChange={(e) => setPlaying(e.target.checked)}
                className="w-4 h-4"
              />
              Play tiles
            </label>

            <div className="lg:ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ai-gray-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 shrink-0" />
                {poller
                  ? poller.enabled
                    ? `Probing every ${poller.intervalSeconds}s`
                    : 'Health poller disabled'
                  : 'Poller status unknown'}
              </span>
              {lastSweep && (
                <span>
                  Last sweep: {lastSweep.probed} probed in {lastSweep.durationMs}ms
                  {lastSweep.skipped > 0 && ` · ${lastSweep.skipped} without a URL`}
                </span>
              )}
            </div>
          </div>

          {probeError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{probeError}</span>
            </div>
          )}

          {/* Every state change the last sweep produced, named. This is the
              proof that pulling a stream really did flip a camera. */}
          {lastSweep && lastSweep.changed.length > 0 && (
            <div className="glass-light rounded-2xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-ai-white mb-2">
                Changed in the last sweep ({lastSweep.changed.length})
              </h2>
              <ul className="space-y-1">
                {lastSweep.changed.slice(0, 8).map((change) => (
                  <li key={change.cameraId} className="text-xs text-ai-gray-300 break-anywhere">
                    <span className="font-medium text-ai-white">{change.cameraId}</span>{' '}
                    {STATUS_PRESENTATION[change.from].label} →{' '}
                    <span className={STATUS_PRESENTATION[change.to].pill.split(' ')[1]}>
                      {STATUS_PRESENTATION[change.to].label}
                    </span>
                    {change.reason ? ` — ${change.reason}` : ''}
                  </li>
                ))}
                {lastSweep.changed.length > 8 && (
                  <li className="text-xs text-ai-gray-500">
                    and {lastSweep.changed.length - 8} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {loadError && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium mb-1">The wall could not load its cameras.</p>
                <p className="text-xs break-anywhere">{loadError}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-[24rem] flex flex-col items-center justify-center text-ai-gray-400">
              <Loader className="w-6 h-6 animate-spin mb-2" />
              Loading the wall…
            </div>
          ) : cameras.length === 0 ? (
            <div className="h-[24rem] flex flex-col items-center justify-center text-center px-6">
              <VideoOff className="w-8 h-8 text-ai-gray-500 mb-3" />
              <p className="text-ai-gray-300 mb-1">No cameras to show.</p>
              <p className="text-ai-gray-500 text-sm">
                {loadError ? 'The registry could not be read.' : 'Register a camera, or clear the department filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {cameras.map((camera) => (
                <CameraTile
                  key={camera.id}
                  camera={camera}
                  active={playing}
                  onExpand={setExpanded}
                  onPlaybackChange={onPlaybackChange}
                />
              ))}
            </div>
          )}

          {!loading && total > 0 && (
            <div className="flex items-center justify-between gap-3 mt-4 text-xs text-ai-gray-400">
              <span>
                Showing {page * GRID_SIZE + 1}–{Math.min((page + 1) * GRID_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-ai-gray-700 hover:bg-ai-gray-900 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span>Page {page + 1} of {pageCount}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="px-3 py-1.5 rounded-lg border border-ai-gray-700 hover:bg-ai-gray-900 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {expanded && <ExpandedCamera camera={expanded} onClose={() => setExpanded(null)} />}
    </div>
  );
};

/** Single camera, larger, with controls and the detail the tile has no room for. */
const ExpandedCamera: React.FC<{ camera: RegistryCamera; onClose: () => void }> = ({
  camera,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [endpoints, setEndpoints] = useState<StreamEndpoints | null>(null);
  const [playback, setPlayback] = useState<Playback>({ state: 'resolving' });
  const report = useCallback((next: Playback) => setPlayback(next), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    surveillance
      .getCameraStream(camera.id)
      .then((result) => {
        if (cancelled) return;
        setEndpoints(result);
        if (!result.playable) setPlayback({ state: 'unplayable', reason: result.reason ?? 'No playable URL' });
      })
      .catch((error: any) => {
        if (!cancelled) setPlayback({ state: 'unplayable', reason: error.message });
      });
    return () => { cancelled = true; };
  }, [camera.id]);

  useHlsPlayer(videoRef, endpoints?.playable ? endpoints.hlsUrl : null, true, report);

  const presentation = STATUS_PRESENTATION[camera.status];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-4xl bg-ai-dark border border-ai-gray-800 rounded-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 p-4 border-b border-ai-gray-800">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ai-white truncate">
              {camera.cameraId} — {camera.name}
            </h2>
            <p className="text-xs text-ai-gray-500 truncate">
              {camera.site?.name ?? 'No site'} · {camera.department?.name ?? 'No department'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            controls
            className={`absolute inset-0 h-full w-full object-contain ${playback.state === 'playing' ? 'opacity-100' : 'opacity-0'}`}
          />
          {playback.state !== 'playing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              {playback.state === 'resolving' || playback.state === 'connecting' || playback.state === 'stalled' ? (
                <>
                  <Loader className="w-7 h-7 animate-spin text-ai-gray-500 mb-2" />
                  <span className="text-sm text-ai-gray-400">
                    {playback.state === 'stalled' ? 'Buffering' : 'Connecting to the stream…'}
                  </span>
                </>
              ) : (
                <>
                  <VideoOff className="w-8 h-8 text-ai-gray-600 mb-2" />
                  <p className="text-sm text-ai-gray-300 mb-1">This feed is not playing.</p>
                  <p className="text-xs text-ai-gray-500 max-w-lg break-anywhere">
                    {'reason' in playback ? playback.reason : 'No reason reported'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-ai-gray-500">Registry status</span>
            <span className={`px-2 py-0.5 rounded border ${presentation.pill}`}>{presentation.label}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ai-gray-500">Last reached</span>
            <span className="text-ai-gray-200">{formatLastSeen(camera.lastSeenAt)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ai-gray-500">Hardware</span>
            <span className="text-ai-gray-200 truncate">
              {camera.vendor ?? '—'}{camera.model ? ` ${camera.model}` : ''}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-ai-gray-500">Configured</span>
            <span className="text-ai-gray-200">
              {camera.resolution ?? 'not recorded'}{camera.fps ? ` · ${camera.fps} fps` : ''}
            </span>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <span className="text-ai-gray-500 shrink-0">Source</span>
            <span className="text-ai-gray-400 truncate break-anywhere">{camera.rtspUrl}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LiveWall;
