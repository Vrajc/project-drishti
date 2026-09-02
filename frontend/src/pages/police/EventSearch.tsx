import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Loader, AlertTriangle, FileDown, Route, Database } from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import * as tracking from '../../services/tracking.service';
import type { Sighting, SearchFacets } from '../../services/tracking.service';

const SNAPSHOT_BASE = import.meta.env.VITE_SNAPSHOT_BASE_URL || '';
const PAGE_SIZE = 50;

const inputClass =
  'w-full px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white ' +
  'placeholder-ai-gray-500 focus:outline-none focus:border-ai-gray-400 transition-colors';

const EventSearch: React.FC = () => {
  const navigate = useNavigate();

  const [detections, setDetections] = useState<Sighting[]>([]);
  const [total, setTotal] = useState(0);
  const [samplingNote, setSamplingNote] = useState('');
  const [facets, setFacets] = useState<SearchFacets | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plate, setPlate] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [objectClass, setObjectClass] = useState('');
  const [color, setColor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    tracking.getFacets().then(setFacets).catch(() => setFacets(null));
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tracking.searchDetections({
        plate: plate || undefined,
        cameraId: cameraId || undefined,
        objectClass: objectClass || undefined,
        color: color || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setDetections(result.detections);
      setTotal(result.total);
      setSamplingNote(result.samplingNote);
    } catch (caught: any) {
      // The table empties and says why. It never keeps stale rows on screen
      // under new filters.
      setDetections([]);
      setTotal(0);
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, [plate, cameraId, objectClass, color, from, to, page]);

  useEffect(() => {
    const timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
  }, [run]);

  const exportCsv = () => {
    // Exports exactly the rows on screen, not the whole matching set, so the
    // file cannot claim more than was actually fetched.
    tracking.downloadCsv(
      `drishti-detections-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`,
      tracking.detectionsToCsv(detections)
    );
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = () => setPage(0);

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
                <Database className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">Detection Search</h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                Filter recorded detections by camera, class, plate, colour and time.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/police/tracking')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <Route className="w-4 h-4" />
                Vehicle trail
              </button>
              <button
                onClick={exportCsv}
                disabled={detections.length === 0}
                className="px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </motion.div>

          <div className="glass-light rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ai-gray-500" />
              <input
                value={plate}
                onChange={(e) => { setPlate(e.target.value); resetPage(); }}
                placeholder="Plate, whole or partial"
                className={`${inputClass} pl-9`}
              />
            </div>

            <select value={cameraId} onChange={(e) => { setCameraId(e.target.value); resetPage(); }} className={inputClass}>
              <option value="">All cameras</option>
              {(facets?.cameras ?? []).map((camera) => (
                <option key={camera.id} value={camera.id}>{camera.cameraId} — {camera.name}</option>
              ))}
            </select>

            <select value={objectClass} onChange={(e) => { setObjectClass(e.target.value); resetPage(); }} className={inputClass}>
              <option value="">All classes</option>
              {(facets?.objectClasses ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>

            <select value={color} onChange={(e) => { setColor(e.target.value); resetPage(); }} className={inputClass}>
              <option value="">Any colour</option>
              {(facets?.colors ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>

            <input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }}
              className={inputClass} aria-label="From" />
            <input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }}
              className={inputClass} aria-label="To" />
          </div>

          {/* The filters only ever offer values that actually occur in the data,
              so an empty dropdown means nothing has been recorded yet. */}
          {facets && facets.cameras.length === 0 && (
            <p className="text-xs text-ai-gray-600 mb-4">
              No camera has recorded a detection yet, so the filters have nothing to offer.
            </p>
          )}

          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{error}</span>
            </div>
          )}

          {samplingNote && (
            <p className="text-[11px] text-ai-gray-600 mb-3 max-w-3xl break-anywhere">{samplingNote}</p>
          )}

          <div className="glass-light rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[60rem]">
                <thead>
                  <tr className="border-b border-ai-gray-800 text-left text-xs uppercase tracking-wide text-ai-gray-500">
                    <th className="px-4 py-3 font-medium">Frame</th>
                    <th className="px-4 py-3 font-medium">Seen</th>
                    <th className="px-4 py-3 font-medium">Camera</th>
                    <th className="px-4 py-3 font-medium">Object</th>
                    <th className="px-4 py-3 font-medium">Plate</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-ai-gray-400">
                      <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />Searching…
                    </td></tr>
                  )}

                  {!loading && !error && detections.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-ai-gray-400">
                      No detection matches these filters.
                    </td></tr>
                  )}

                  {!loading && detections.map((detection) => (
                    <tr key={detection.detectionId} className="border-b border-ai-gray-900 hover:bg-ai-gray-900/40 transition-colors">
                      <td className="px-4 py-3 align-top w-32">
                        {detection.snapshotPath ? (
                          <>
                            <img
                              src={`${SNAPSHOT_BASE}${detection.snapshotPath}`}
                              alt=""
                              className="w-28 aspect-video object-cover rounded bg-ai-gray-900"
                              loading="lazy"
                            onError={(event) => {
                              const target = event.currentTarget;
                              target.style.display = 'none';
                              const sibling = target.nextElementSibling as HTMLElement | null;
                              if (sibling) sibling.style.display = 'flex';
                            }}
                            />
                            <div
                              style={{ display: 'none' }}
                              className="w-28 aspect-video rounded bg-ai-gray-900 border border-ai-gray-800 items-center justify-center text-[10px] text-ai-gray-600 text-center px-1"
                            >
                              recorded, not served here
                            </div>
                          </>
                        ) : (
                          <div className="w-28 aspect-video rounded bg-ai-gray-900 border border-ai-gray-800 flex items-center justify-center text-[10px] text-ai-gray-600 text-center px-1">
                            no snapshot stored
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ai-gray-300">
                        {new Date(detection.ts).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-ai-gray-200 text-xs">{detection.camera.cameraId}</p>
                        <p className="text-ai-gray-500 text-[11px] mt-0.5">{detection.camera.name}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-ai-gray-200 text-xs">{detection.vehicleType ?? detection.objectClass}</p>
                        <p className="text-ai-gray-500 text-[11px] mt-0.5">
                          {detection.color ?? 'colour not measured'}
                          {detection.trackId !== null ? ` · track ${detection.trackId}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-xs">
                        {detection.plateNumber ? (
                          <>
                            <span className="text-ai-gray-200">{detection.plateNumber}</span>
                            {detection.plateConfidence !== null && (
                              <p className="text-ai-gray-500 text-[11px] mt-0.5">
                                OCR {(detection.plateConfidence * 100).toFixed(0)}%
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-ai-gray-600">not read</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ai-gray-300">
                        {(detection.confidence * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && total > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-ai-gray-800 text-xs text-ai-gray-400">
                <span>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-ai-gray-700 hover:bg-ai-gray-900 disabled:opacity-40 transition-colors">
                    Previous
                  </button>
                  <span>Page {page + 1} of {pageCount}</span>
                  <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                    className="px-3 py-1.5 rounded-lg border border-ai-gray-700 hover:bg-ai-gray-900 disabled:opacity-40 transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventSearch;
