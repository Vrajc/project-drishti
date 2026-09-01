import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Camera as CameraIcon, Search, Plus, MapPin, Pencil, Trash2, X, Loader, AlertTriangle, Map as MapIcon,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import * as surveillance from '../../services/surveillance.service';
import type {
  RegistryCamera, Department, Site, RegistryStats, CameraPayload,
} from '../../services/surveillance.service';
import { STATUS_PRESENTATION, STATUS_ORDER, formatLastSeen, formatCoordinates } from './cameraStatus';

const PAGE_SIZE = 25;

// Every field the registry stores, as strings, because that is what an <input>
// holds. They are converted once, on submit.
interface FormState {
  cameraId: string;
  name: string;
  location: string;
  ipAddress: string;
  rtspUrl: string;
  latitude: string;
  longitude: string;
  coverageAngle: string;
  coverageRadius: string;
  isPtz: boolean;
  vendor: string;
  model: string;
  protocol: string;
  onvifUrl: string;
  username: string;
  password: string;
  resolution: string;
  fps: string;
  departmentId: string;
  siteId: string;
}

const EMPTY_FORM: FormState = {
  cameraId: '', name: '', location: '', ipAddress: '', rtspUrl: '',
  latitude: '', longitude: '', coverageAngle: '', coverageRadius: '', isPtz: false,
  vendor: '', model: '', protocol: '', onvifUrl: '', username: '', password: '',
  resolution: '', fps: '', departmentId: '', siteId: '',
};

function toForm(camera: RegistryCamera): FormState {
  return {
    cameraId: camera.cameraId,
    name: camera.name,
    location: camera.location,
    ipAddress: camera.ipAddress ?? '',
    rtspUrl: camera.rtspUrl,
    latitude: camera.latitude === null ? '' : String(camera.latitude),
    longitude: camera.longitude === null ? '' : String(camera.longitude),
    coverageAngle: camera.coverageAngle === null ? '' : String(camera.coverageAngle),
    coverageRadius: camera.coverageRadius === null ? '' : String(camera.coverageRadius),
    isPtz: camera.isPtz,
    vendor: camera.vendor ?? '',
    model: camera.model ?? '',
    protocol: camera.protocol ?? '',
    onvifUrl: camera.onvifUrl ?? '',
    username: camera.username ?? '',
    // Never pre-filled: the server does not return the stored credential.
    password: '',
    resolution: camera.resolution ?? '',
    fps: camera.fps === null ? '' : String(camera.fps),
    departmentId: camera.departmentId ?? '',
    siteId: camera.siteId ?? '',
  };
}

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));
const textOrNull = (value: string) => (value.trim() === '' ? null : value.trim());

function toPayload(form: FormState, isEdit: boolean): CameraPayload {
  const payload: CameraPayload = {
    cameraId: form.cameraId.trim(),
    name: form.name.trim(),
    location: form.location.trim(),
    ipAddress: form.ipAddress.trim(),
    rtspUrl: form.rtspUrl.trim(),
    latitude: numberOrNull(form.latitude),
    longitude: numberOrNull(form.longitude),
    coverageAngle: numberOrNull(form.coverageAngle),
    coverageRadius: numberOrNull(form.coverageRadius),
    isPtz: form.isPtz,
    vendor: textOrNull(form.vendor),
    model: textOrNull(form.model),
    protocol: textOrNull(form.protocol),
    onvifUrl: textOrNull(form.onvifUrl),
    username: textOrNull(form.username),
    resolution: textOrNull(form.resolution),
    fps: numberOrNull(form.fps),
    departmentId: textOrNull(form.departmentId),
    siteId: textOrNull(form.siteId),
  };

  // On an edit, an untouched password field must leave the stored credential
  // alone. Sending '' would clear it.
  if (!isEdit || form.password !== '') {
    payload.password = form.password === '' ? null : form.password;
  }

  return payload;
}

const inputClass =
  'w-full px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white ' +
  'placeholder-ai-gray-500 focus:outline-none focus:border-ai-gray-400 transition-colors';

const labelClass = 'block text-xs font-medium text-ai-gray-400 mb-1.5';

const CameraRegistry: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'police';

  const [cameras, setCameras] = useState<RegistryCamera[]>([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<RegistryCamera | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadCameras = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await surveillance.getCameras({
        q: search || undefined,
        status: statusFilter || undefined,
        departmentId: departmentFilter || undefined,
        siteId: siteFilter || undefined,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setCameras(result.cameras);
      setTotal(result.total);
    } catch (error: any) {
      // The table stays empty and says why. It never falls back to stale rows.
      setCameras([]);
      setTotal(0);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, siteFilter, page]);

  const loadReference = useCallback(async () => {
    try {
      const [deptRows, siteRows, statRow] = await Promise.all([
        surveillance.getDepartments(),
        surveillance.getSites(),
        surveillance.getRegistryStats(),
      ]);
      setDepartments(deptRows);
      setSites(siteRows);
      setStats(statRow);
    } catch (error: any) {
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    loadReference();
  }, [loadReference]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(loadCameras, 250);
    return () => clearTimeout(timer);
  }, [loadCameras]);

  const sitesForForm = useMemo(
    () => (form.departmentId ? sites.filter((s) => s.department?.id === form.departmentId) : sites),
    [sites, form.departmentId]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (camera: RegistryCamera) => {
    setEditing(camera);
    setForm(toForm(camera));
    setFormError(null);
    setIsFormOpen(true);
  };

  const submitForm = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const payload = toPayload(form, Boolean(editing));
      if (editing) {
        await surveillance.updateCamera(editing.id, payload);
      } else {
        await surveillance.createCamera(payload);
      }
      setIsFormOpen(false);
      await Promise.all([loadCameras(), loadReference()]);
    } catch (error: any) {
      // The form stays open holding what was typed, showing the server's reason.
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeCamera = async (camera: RegistryCamera) => {
    setDeletingId(camera.id);
    setActionError(null);
    try {
      await surveillance.deleteCamera(camera.id);
      await Promise.all([loadCameras(), loadReference()]);
    } catch (error: any) {
      setActionError(`Could not remove ${camera.cameraId}: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CameraIcon className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">
                  Camera Registry
                </h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                Every camera in the estate, whether or not an event is using it.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/surveillance/map')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <MapIcon className="w-4 h-4" />
                Map view
              </button>
              {canWrite && (
                <button
                  onClick={openCreate}
                  className="px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Register camera
                </button>
              )}
            </div>
          </motion.div>

          {/* Counts. Each one is a COUNT over the cameras table, not an estimate. */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
            >
              <div className="glass-light rounded-2xl p-4">
                <p className="text-xs text-ai-gray-400 mb-1">Cameras registered</p>
                <p className="text-2xl font-bold text-ai-white">{stats.total}</p>
                <p className="text-xs text-ai-gray-500 mt-1">
                  {stats.registryOnly} standalone · {stats.attachedToEvent} on events
                </p>
              </div>

              <div className="glass-light rounded-2xl p-4">
                <p className="text-xs text-ai-gray-400 mb-1">Surveyed</p>
                <p className="text-2xl font-bold text-ai-white">{stats.located}</p>
                <p className="text-xs text-ai-gray-500 mt-1">
                  {stats.unlocated > 0
                    ? `${stats.unlocated} awaiting coordinates`
                    : 'every camera has coordinates'}
                </p>
              </div>

              <div className="glass-light rounded-2xl p-4">
                <p className="text-xs text-ai-gray-400 mb-1">PTZ units</p>
                <p className="text-2xl font-bold text-ai-white">{stats.ptz}</p>
                <p className="text-xs text-ai-gray-500 mt-1">of {stats.total} total</p>
              </div>

              <div className="glass-light rounded-2xl p-4">
                <p className="text-xs text-ai-gray-400 mb-1">Last health check</p>
                {stats.lastHealthCheckAt ? (
                  <>
                    <p className="text-base font-semibold text-ai-white">
                      {new Date(stats.lastHealthCheckAt).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-ai-gray-500 mt-1">
                      {new Date(stats.lastHealthCheckAt).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold text-ai-gray-400">Never run</p>
                    <p className="text-xs text-ai-gray-500 mt-1">
                      every camera reads “not yet probed”
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Status breakdown, straight from the GROUP BY. */}
          {stats && (
            <div className="flex flex-wrap gap-2 mb-6">
              {STATUS_ORDER.map((status) => (
                <span
                  key={status}
                  className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${STATUS_PRESENTATION[status].pill}`}
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_PRESENTATION[status].dot}`} />
                  {STATUS_PRESENTATION[status].label}: {stats.byStatus[status] ?? 0}
                </span>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="glass-light rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ai-gray-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search id, name, location, IP, vendor"
                className={`${inputClass} pl-9`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className={inputClass}
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>{STATUS_PRESENTATION[status].label}</option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setSiteFilter(''); setPage(0); }}
              className={inputClass}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.cameraCount})</option>
              ))}
            </select>

            <select
              value={siteFilter}
              onChange={(e) => { setSiteFilter(e.target.value); setPage(0); }}
              className={inputClass}
            >
              <option value="">All sites</option>
              {sites
                .filter((s) => !departmentFilter || s.department?.id === departmentFilter)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.cameraCount})</option>
                ))}
            </select>
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{actionError}</span>
            </div>
          )}

          {/* Table */}
          <div className="glass-light rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[62rem]">
                <thead>
                  <tr className="border-b border-ai-gray-800 text-left text-xs uppercase tracking-wide text-ai-gray-500">
                    <th className="px-4 py-3 font-medium">Camera</th>
                    <th className="px-4 py-3 font-medium">Site / Department</th>
                    <th className="px-4 py-3 font-medium">Hardware</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last reached</th>
                    {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} className="px-4 py-12 text-center text-ai-gray-400">
                        <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading registry…
                      </td>
                    </tr>
                  )}

                  {!loading && loadError && (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} className="px-4 py-12 text-center">
                        <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                        <p className="text-red-300 mb-1">The registry could not be loaded.</p>
                        <p className="text-ai-gray-500 text-xs break-anywhere">{loadError}</p>
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && cameras.length === 0 && (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} className="px-4 py-12 text-center text-ai-gray-400">
                        No camera matches these filters.
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && cameras.map((camera) => {
                    const presentation = STATUS_PRESENTATION[camera.status];
                    const coords = formatCoordinates(camera.latitude, camera.longitude);

                    return (
                      <tr key={camera.id} className="border-b border-ai-gray-900 hover:bg-ai-gray-900/40 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-ai-white">{camera.cameraId}</p>
                          <p className="text-ai-gray-400 text-xs mt-0.5">{camera.name}</p>
                          <p className="text-ai-gray-600 text-xs mt-0.5 break-anywhere">{camera.rtspUrl}</p>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <p className="text-ai-gray-200">{camera.site?.name ?? '—'}</p>
                          <p className="text-ai-gray-500 text-xs mt-0.5">{camera.department?.name ?? 'No department'}</p>
                          {camera.event && (
                            <p className="text-ai-gray-500 text-xs mt-0.5">On event: {camera.event.name}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <p className="text-ai-gray-200">
                            {camera.vendor ?? '—'}{camera.model ? ` ${camera.model}` : ''}
                          </p>
                          <p className="text-ai-gray-500 text-xs mt-0.5">
                            {/* Configured values from the inventory, not measured from the stream. */}
                            {camera.resolution ?? 'resolution not recorded'}
                            {camera.fps ? ` · ${camera.fps} fps configured` : ''}
                            {camera.protocol ? ` · ${camera.protocol}` : ''}
                            {camera.isPtz ? ' · PTZ' : ''}
                          </p>
                        </td>

                        <td className="px-4 py-3 align-top">
                          {coords ? (
                            <span className="text-ai-gray-200 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-ai-gray-500 shrink-0" />
                              <span className="text-xs">{coords}</span>
                            </span>
                          ) : (
                            <span className="text-ai-gray-500 text-xs">Not surveyed</span>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top">
                          <span className={`px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1.5 whitespace-nowrap ${presentation.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${presentation.dot}`} />
                            {presentation.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top text-xs text-ai-gray-400">
                          {formatLastSeen(camera.lastSeenAt)}
                        </td>

                        {canWrite && (
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(camera)}
                                aria-label={`Edit ${camera.cameraId}`}
                                className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-800 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeCamera(camera)}
                                disabled={deletingId === camera.id}
                                aria-label={`Remove ${camera.cameraId}`}
                                className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-red-300 hover:bg-ai-gray-800 transition-colors disabled:opacity-40"
                              >
                                {deletingId === camera.id
                                  ? <Loader className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!loading && !loadError && total > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-ai-gray-800 text-xs text-ai-gray-400">
                <span>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
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
      </div>

      {/* Create / edit */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={submitForm}
            className="w-full max-w-3xl my-8 bg-ai-dark border border-ai-gray-800 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-ai-white">
                  {editing ? `Edit ${editing.cameraId}` : 'Register a camera'}
                </h2>
                <p className="text-xs text-ai-gray-500 mt-1">
                  Status and last-reached are set by the health checker, never by this form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Close"
                className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <section>
                <h3 className="text-xs uppercase tracking-wide text-ai-gray-500 mb-3">Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="cameraId">Camera id *</label>
                    <input id="cameraId" required value={form.cameraId}
                      onChange={(e) => setForm({ ...form, cameraId: e.target.value })}
                      placeholder="GNR-019" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="name">Name *</label>
                    <input id="name" required value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Sector 21 Market Entrance" className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="location">Location *</label>
                    <input id="location" required value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Sector 21, Gandhinagar" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="departmentId">Department</label>
                    <select id="departmentId" value={form.departmentId}
                      onChange={(e) => setForm({ ...form, departmentId: e.target.value, siteId: '' })}
                      className={inputClass}>
                      <option value="">Unassigned</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="siteId">Site</label>
                    <select id="siteId" value={form.siteId}
                      onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                      className={inputClass}>
                      <option value="">Unassigned</option>
                      {sitesForForm.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wide text-ai-gray-500 mb-3">Connection</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="rtspUrl">Stream URL *</label>
                    <input id="rtspUrl" required value={form.rtspUrl}
                      onChange={(e) => setForm({ ...form, rtspUrl: e.target.value })}
                      placeholder="rtsp://mediamtx:8554/cam57" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="ipAddress">IP address</label>
                    <input id="ipAddress" value={form.ipAddress}
                      onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                      placeholder="10.42.1.70" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="protocol">Protocol</label>
                    <select id="protocol" value={form.protocol}
                      onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                      className={inputClass}>
                      <option value="">Not recorded</option>
                      <option value="RTSP">RTSP</option>
                      <option value="ONVIF">ONVIF</option>
                      <option value="HTTP">HTTP</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="onvifUrl">ONVIF device service URL</label>
                    <input id="onvifUrl" value={form.onvifUrl}
                      onChange={(e) => setForm({ ...form, onvifUrl: e.target.value })}
                      placeholder="http://10.42.1.70/onvif/device_service" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="username">Stream username</label>
                    <input id="username" value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      autoComplete="off" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="password">
                      Stream password
                      {editing?.hasCredentials ? ' (stored — leave blank to keep)' : ''}
                    </label>
                    <input id="password" type="password" value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      autoComplete="new-password" className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wide text-ai-gray-500 mb-3">
                  Position <span className="normal-case tracking-normal">— leave blank until surveyed</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="latitude">Latitude</label>
                    <input id="latitude" type="number" step="any" value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      placeholder="23.2295" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="longitude">Longitude</label>
                    <input id="longitude" type="number" step="any" value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      placeholder="72.6486" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="coverageAngle">Bearing (degrees from north)</label>
                    <input id="coverageAngle" type="number" step="any" min="0" max="360" value={form.coverageAngle}
                      onChange={(e) => setForm({ ...form, coverageAngle: e.target.value })}
                      placeholder="90" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="coverageRadius">Range (metres)</label>
                    <input id="coverageRadius" type="number" step="any" min="0" value={form.coverageRadius}
                      onChange={(e) => setForm({ ...form, coverageRadius: e.target.value })}
                      placeholder="60" className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs uppercase tracking-wide text-ai-gray-500 mb-3">
                  Hardware <span className="normal-case tracking-normal">— as configured, not measured</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="vendor">Vendor</label>
                    <input id="vendor" value={form.vendor}
                      onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                      placeholder="Hikvision" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="model">Model</label>
                    <input id="model" value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="DS-2CD2143G2-I" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="resolution">Resolution</label>
                    <input id="resolution" value={form.resolution}
                      onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                      placeholder="1920x1080" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="fps">Frame rate</label>
                    <input id="fps" type="number" min="1" max="240" value={form.fps}
                      onChange={(e) => setForm({ ...form, fps: e.target.value })}
                      placeholder="25" className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-ai-gray-300">
                      <input type="checkbox" checked={form.isPtz}
                        onChange={(e) => setForm({ ...form, isPtz: e.target.checked })}
                        className="w-4 h-4" />
                      Pan / tilt / zoom unit
                    </label>
                  </div>
                </div>
              </section>
            </div>

            {formError && (
              <div className="mt-5 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-anywhere">{formError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {editing ? 'Save changes' : 'Register camera'}
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </div>
  );
};

export default CameraRegistry;
