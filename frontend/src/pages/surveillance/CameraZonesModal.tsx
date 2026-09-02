import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, Trash2, AlertTriangle, Plus, Undo2, Play, Square } from 'lucide-react';
import * as surveillance from '../../services/surveillance.service';
import type {
  CameraZone, DetectorStatus, RegistryCamera, ZoneVertex,
} from '../../services/surveillance.service';

/**
 * Defining the counting zones on a camera.
 *
 * A CrowdDensity row is a count of people inside a zone, and until this screen
 * existed there was no way to create one - a Zone with a cameraId could only be
 * written by hand against the database. Every crowd number in the product
 * depends on one, so this is the step that makes counting reachable at all.
 *
 * The polygon is drawn in percentages of the camera frame rather than pixels.
 * The detector scales zone geometry from a stated reference canvas into the
 * frame it captured and refuses to guess one; percentages make that reference
 * a constant, so a zone drawn here stays correct at any resolution.
 *
 * There is no frame behind the canvas. Drawing over a still would be better and
 * is worth adding once snapshots are served, but a placeholder image of a
 * street that is not this camera's view would be worse than an empty grid: an
 * operator would place boundaries against a scene the detector never sees.
 */

interface Props {
  camera: RegistryCamera;
  onClose: () => void;
  /** Called after any change, so the registry can refresh its zone counts. */
  onChanged?: () => void;
}

const CANVAS = 100; // the reference canvas, in percent

const CameraZonesModal: React.FC<Props> = ({ camera, onClose, onChanged }) => {
  const [zones, setZones] = useState<CameraZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ZoneVertex[]>([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detector, setDetector] = useState<DetectorStatus | null>(null);
  const [detectorBusy, setDetectorBusy] = useState(false);
  const [detectorNote, setDetectorNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, status] = await Promise.all([
        surveillance.getCameraZones(camera.id),
        // A detector that is not configured is a normal state for a deployment
        // without the camera stack, so this never fails the whole dialog.
        surveillance.getDetectionStatus().catch(() => null),
      ]);
      setZones(data?.zones ?? []);
      setDetector(status ?? null);
      setLoadError(null);
    } catch (error: any) {
      setZones([]);
      setLoadError(error?.message ?? 'Zones could not be read');
    } finally {
      setLoading(false);
    }
  }, [camera.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const addVertex = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS;
    setDraft([...draft, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
    setFormError(null);
  };

  const save = async () => {
    if (!name.trim()) {
      setFormError('A zone needs a name');
      return;
    }
    const max = Number(capacity);
    if (!Number.isFinite(max) || max <= 0) {
      setFormError('A zone needs a maximum capacity above zero: density is a percentage of it');
      return;
    }
    if (draft.length < 3) {
      setFormError('Click at least three points on the frame to enclose an area');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await surveillance.createCameraZone(camera.id, {
        name: name.trim(),
        maxCapacity: Math.round(max),
        coordinates: draft,
      });
      setDraft([]);
      setName('');
      setCapacity('');
      await load();
      onChanged?.();
    } catch (error: any) {
      setFormError(error?.message ?? 'The zone could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (zone: CameraZone) => {
    setBusyId(zone.id);
    try {
      await surveillance.deleteCameraZone(zone.id);
      await load();
      onChanged?.();
    } catch (error: any) {
      setLoadError(error?.message ?? 'The zone could not be deleted');
    } finally {
      setBusyId(null);
    }
  };

  const runningHere = (detector?.workers ?? []).find(
    (worker) => (worker.cameraId ?? worker.camera_id) === camera.cameraId
  );

  const toggleDetection = async (start: boolean) => {
    setDetectorBusy(true);
    setDetectorNote(null);
    try {
      const result = start
        ? await surveillance.startCameraDetection(camera.id)
        : await surveillance.stopCameraDetection(camera.id);
      setDetectorNote(result?.message ?? null);
      await load();
      onChanged?.();
    } catch (error: any) {
      setDetectorNote(error?.message ?? 'The detector did not answer');
    } finally {
      setDetectorBusy(false);
    }
  };

  const toPath = (points: ZoneVertex[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const existingPaths = useMemo(
    () =>
      zones
        .filter((zone) => Array.isArray(zone.coordinates) && zone.coordinates.length >= 3)
        .map((zone) => ({ id: zone.id, name: zone.name, d: toPath(zone.coordinates) })),
    [zones]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-ai-gray-800 bg-ai-black"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-ai-gray-800 bg-ai-black">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-ai-white truncate">
              Counting zones — {camera.name}
            </h2>
            <p className="text-xs text-ai-gray-500 truncate">
              {camera.cameraId} · {camera.location}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <p className="text-sm text-ai-gray-400">
            A crowd count is a count of people inside a zone. Click points on the frame below to
            trace one, name it, and give it the capacity its density should be measured against.
            Coordinates are percentages of the camera's view, so a zone stays correct if the stream
            resolution changes.
          </p>

          {loadError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/40 p-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ai-gray-300 break-anywhere">{loadError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* The frame */}
            <div className="lg:col-span-3">
              <div className="relative rounded-xl border border-ai-gray-800 overflow-hidden bg-ai-gray-900">
                <svg
                  viewBox={`0 0 ${CANVAS} ${CANVAS}`}
                  onClick={addVertex}
                  className="w-full aspect-video cursor-crosshair"
                  role="img"
                  aria-label="Camera frame, click to place zone vertices"
                >
                  <defs>
                    <pattern id="zone-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path
                        d="M 10 0 L 0 0 0 10"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="0.3"
                      />
                    </pattern>
                  </defs>
                  <rect width={CANVAS} height={CANVAS} fill="url(#zone-grid)" />

                  {existingPaths.map((zone) => (
                    <g key={zone.id}>
                      <path
                        d={zone.d}
                        fill="rgba(255,255,255,0.07)"
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth="0.4"
                      />
                    </g>
                  ))}

                  {draft.length > 0 && (
                    <>
                      <path
                        d={toPath(draft)}
                        fill="rgba(52,211,153,0.15)"
                        stroke="#34d399"
                        strokeWidth="0.5"
                        strokeDasharray={draft.length < 3 ? '1.5 1' : undefined}
                      />
                      {draft.map((point, i) => (
                        <circle key={i} cx={point.x} cy={point.y} r="0.9" fill="#34d399" />
                      ))}
                    </>
                  )}
                </svg>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-ai-gray-500">
                  {draft.length === 0
                    ? 'Click the frame to start tracing'
                    : `${draft.length} point${draft.length === 1 ? '' : 's'} placed`}
                </span>
                {draft.length > 0 && (
                  <>
                    <button
                      onClick={() => setDraft(draft.slice(0, -1))}
                      className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-ai-gray-700 text-ai-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Undo point
                    </button>
                    <button
                      onClick={() => setDraft([])}
                      className="px-3 py-1.5 text-xs rounded-lg border border-ai-gray-700 text-ai-gray-300 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Naming and the zone list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-ai-gray-800 p-4 space-y-3">
                <h3 className="text-sm font-medium text-ai-white">New zone</h3>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Zone name (e.g. North Gate)"
                  className="w-full px-3 py-2.5 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:border-ai-white focus:outline-none transition-colors"
                />
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Max capacity"
                  className="w-full px-3 py-2.5 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:border-ai-white focus:outline-none transition-colors"
                />
                {formError && <p className="text-sm text-red-400 break-anywhere">{formError}</p>}
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full px-4 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save zone
                    </>
                  )}
                </button>
              </div>

              {/* Detection: the step that turns a drawn zone into counts. */}
              <div className="rounded-xl border border-ai-gray-800 p-4 space-y-3">
                <h3 className="text-sm font-medium text-ai-white">Detection</h3>

                {detector === null ? (
                  <p className="text-sm text-ai-gray-500">Detector status unavailable.</p>
                ) : !detector.configured ? (
                  <p className="text-sm text-ai-gray-500">{detector.reason}</p>
                ) : !detector.reachable ? (
                  <p className="text-sm text-amber-400 break-anywhere">{detector.reason}</p>
                ) : (
                  <>
                    <p className="text-sm text-ai-gray-400">
                      {runningHere
                        ? `Running on this camera — ${runningHere.state.toLowerCase()}`
                        : 'Not running on this camera. Nothing is being counted through it.'}
                    </p>
                    <button
                      onClick={() => toggleDetection(!runningHere)}
                      disabled={detectorBusy}
                      className="w-full px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:text-white hover:border-ai-gray-500 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {detectorBusy ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : runningHere ? (
                        <Square className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {runningHere ? 'Stop detection' : 'Start detection'}
                    </button>
                  </>
                )}

                {detectorNote && (
                  <p className="text-xs text-ai-gray-400 break-anywhere">{detectorNote}</p>
                )}
              </div>

              <div className="rounded-xl border border-ai-gray-800 p-4">
                <h3 className="text-sm font-medium text-ai-white mb-3">
                  Defined zones {zones.length > 0 && `(${zones.length})`}
                </h3>

                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-ai-gray-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    Reading zones…
                  </div>
                ) : zones.length === 0 ? (
                  <p className="text-sm text-ai-gray-500">
                    None yet. Nothing can be counted through this camera until a zone exists.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {zones.map((zone) => (
                      <li
                        key={zone.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-ai-gray-800/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-ai-gray-200 truncate">{zone.name}</p>
                          <p className="text-xs text-ai-gray-500">
                            {zone.maxCapacity.toLocaleString()} capacity ·{' '}
                            {Array.isArray(zone.coordinates) ? zone.coordinates.length : 0} points
                          </p>
                        </div>
                        <button
                          onClick={() => remove(zone)}
                          disabled={busyId === zone.id}
                          aria-label={`Delete ${zone.name}`}
                          className="icon-btn shrink-0 p-1 text-ai-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {busyId === zone.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {zones.length > 0 && (
                  <p className="text-xs text-ai-gray-600 mt-3">
                    Deleting a zone also deletes the counts recorded inside it.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CameraZonesModal;
