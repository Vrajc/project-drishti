import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Upload, Trash2, Pencil, X, Loader, AlertTriangle, Bell, ShieldAlert,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import * as watchlist from '../../services/watchlist.service';
import type { WatchlistEntry, WatchlistPayload, ImportResult } from '../../services/watchlist.service';

const SEVERITIES: Array<WatchlistEntry['severity']> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const SEVERITY_PILL: Record<string, string> = {
  LOW: 'bg-ai-gray-800 text-ai-gray-300 border-ai-gray-700',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  HIGH: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  CRITICAL: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const inputClass =
  'w-full px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white ' +
  'placeholder-ai-gray-500 focus:outline-none focus:border-ai-gray-400 transition-colors';
const labelClass = 'block text-xs font-medium text-ai-gray-400 mb-1.5';

const EMPTY: WatchlistPayload = {
  entityType: 'VEHICLE',
  plateNumber: '',
  vehicleMakeModel: '',
  color: '',
  personName: '',
  caseNumber: '',
  caseType: '',
  severity: 'MEDIUM',
  expiresAt: '',
  notes: '',
};

const CSV_TEMPLATE =
  'plateNumber,caseNumber,caseType,vehicleMakeModel,color,severity,notes\n' +
  'GJ01AB1234,FIR-2026-1188,Stolen vehicle,Maruti Swift,white,HIGH,Reported from Sector 21\n';

const Watchlist: React.FC = () => {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<WatchlistEntry | null>(null);
  const [form, setForm] = useState<WatchlistPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEntries(
        await watchlist.getWatchlist({
          q: search || undefined,
          active: activeFilter || undefined,
        })
      );
    } catch (error: any) {
      setEntries([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (entry: WatchlistEntry) => {
    setEditing(entry);
    setForm({
      entityType: entry.entityType,
      plateNumber: entry.plateNumber ?? '',
      vehicleMakeModel: entry.vehicleMakeModel ?? '',
      color: entry.color ?? '',
      personName: entry.personName ?? '',
      caseNumber: entry.caseNumber,
      caseType: entry.caseType,
      severity: entry.severity,
      expiresAt: entry.expiresAt ? entry.expiresAt.slice(0, 10) : '',
      isActive: entry.isActive,
      notes: entry.notes ?? '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: WatchlistPayload = {
        ...form,
        expiresAt: form.expiresAt ? form.expiresAt : null,
      };
      if (editing) await watchlist.updateWatchlistEntry(editing.id, payload);
      else await watchlist.createWatchlistEntry(payload);
      setIsFormOpen(false);
      await load();
    } catch (error: any) {
      // The form stays open holding what was typed, showing the server's reason.
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: WatchlistEntry) => {
    setActionError(null);
    try {
      await watchlist.deleteWatchlistEntry(entry.id);
      await load();
    } catch (error: any) {
      // Includes the server's refusal to delete an entry that has raised alerts.
      setActionError(error.message);
    }
  };

  const toggleActive = async (entry: WatchlistEntry) => {
    setActionError(null);
    try {
      await watchlist.updateWatchlistEntry(entry.id, { isActive: !entry.isActive });
      await load();
    } catch (error: any) {
      setActionError(error.message);
    }
  };

  const runImport = async () => {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      setImportResult(await watchlist.importWatchlistCsv(csv));
      await load();
    } catch (error: any) {
      setImportError(error.message);
    } finally {
      setImporting(false);
    }
  };

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
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">Watchlist</h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                Plates the match engine compares every reading against. An active entry fires
                within seconds of a camera reading its plate.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/police/alerts')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <Bell className="w-4 h-4" />
                Alerts
              </button>
              <button
                onClick={() => { setIsImportOpen(true); setImportResult(null); setImportError(null); }}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button
                onClick={openCreate}
                className="px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add entry
              </button>
            </div>
          </motion.div>

          <div className="glass-light rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ai-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Plate, case number, name or make"
                className={`${inputClass} pl-9`}
              />
            </div>
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className={inputClass}>
              <option value="">Active and inactive</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{actionError}</span>
            </div>
          )}

          <div className="glass-light rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[56rem]">
                <thead>
                  <tr className="border-b border-ai-gray-800 text-left text-xs uppercase tracking-wide text-ai-gray-500">
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Severity</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                    <th className="px-4 py-3 font-medium">Alerts</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-ai-gray-400">
                      <Loader className="w-5 h-5 animate-spin mx-auto mb-2" />Loading the watchlist…
                    </td></tr>
                  )}

                  {!loading && loadError && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                      <p className="text-red-300 mb-1">The watchlist could not be loaded.</p>
                      <p className="text-ai-gray-500 text-xs break-anywhere">{loadError}</p>
                    </td></tr>
                  )}

                  {!loading && !loadError && entries.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-ai-gray-400">
                      Nothing on the watchlist yet. Add a plate, or import a stolen-vehicle list.
                    </td></tr>
                  )}

                  {!loading && !loadError && entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-ai-gray-900 hover:bg-ai-gray-900/40 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-ai-white">
                          {entry.entityType === 'VEHICLE' ? entry.plateNumber : entry.personName}
                        </p>
                        <p className="text-ai-gray-500 text-xs mt-0.5">
                          {entry.entityType === 'VEHICLE'
                            ? [entry.vehicleMakeModel, entry.color].filter(Boolean).join(' · ') || 'No vehicle detail'
                            : 'Person'}
                        </p>
                        {entry.plateNormalised && entry.plateNormalised !== entry.plateNumber && (
                          <p className="text-ai-gray-600 text-[11px] mt-0.5">
                            {/* Shown because it is what actually gets compared. */}
                            matched as {entry.plateNormalised}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-ai-gray-200">{entry.caseNumber}</p>
                        <p className="text-ai-gray-500 text-xs mt-0.5">{entry.caseType}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`px-2 py-0.5 rounded border text-xs ${SEVERITY_PILL[entry.severity]}`}>
                          {entry.severity.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-ai-gray-400">
                        <p>{new Date(entry.issuedAt).toLocaleDateString()}</p>
                        <p className="text-ai-gray-600 mt-0.5">{entry.issuer?.name ?? 'Unknown issuer'}</p>
                        {entry.expiresAt && (
                          <p className="text-ai-gray-600 mt-0.5">expires {new Date(entry.expiresAt).toLocaleDateString()}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-ai-gray-200">{entry.alertCount}</td>
                      <td className="px-4 py-3 align-top">
                        <button
                          onClick={() => toggleActive(entry)}
                          className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                            entry.isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-ai-gray-800 text-ai-gray-400 border-ai-gray-700 hover:bg-ai-gray-700'
                          }`}
                        >
                          {entry.isActive ? 'matching' : 'paused'}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(entry)} aria-label={`Edit ${entry.caseNumber}`}
                            className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-800 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(entry)} aria-label={`Delete ${entry.caseNumber}`}
                            className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-red-300 hover:bg-ai-gray-800 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={submit}
            className="w-full max-w-2xl my-8 bg-ai-dark border border-ai-gray-800 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-ai-white">
                  {editing ? `Edit ${editing.caseNumber}` : 'Add a watchlist entry'}
                </h2>
                <p className="text-xs text-ai-gray-500 mt-1">
                  Recorded against your account as the issuing officer.
                </p>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} aria-label="Close"
                className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="entityType">Subject type</label>
                <select id="entityType" value={form.entityType}
                  onChange={(e) => setForm({ ...form, entityType: e.target.value as any })}
                  className={inputClass}>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="PERSON">Person</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="severity">Severity</label>
                <select id="severity" value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
                  className={inputClass}>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                </select>
              </div>

              {form.entityType === 'VEHICLE' ? (
                <>
                  <div>
                    <label className={labelClass} htmlFor="plateNumber">Plate number *</label>
                    <input id="plateNumber" required value={form.plateNumber}
                      onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                      placeholder="GJ 01 AB 1234" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="vehicleMakeModel">Make and model</label>
                    <input id="vehicleMakeModel" value={form.vehicleMakeModel}
                      onChange={(e) => setForm({ ...form, vehicleMakeModel: e.target.value })}
                      placeholder="Maruti Swift" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="color">Colour</label>
                    <input id="color" value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      placeholder="white" className={inputClass} />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="personName">Name *</label>
                  <input id="personName" required value={form.personName}
                    onChange={(e) => setForm({ ...form, personName: e.target.value })}
                    className={inputClass} />
                  <p className="text-[11px] text-ai-gray-600 mt-1.5">
                    Face matching is not implemented, so a person entry is a record only — it will
                    not raise alerts.
                  </p>
                </div>
              )}

              <div>
                <label className={labelClass} htmlFor="caseNumber">Case number *</label>
                <input id="caseNumber" required value={form.caseNumber}
                  onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
                  placeholder="FIR-2026-1188" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="caseType">Case type *</label>
                <input id="caseType" required value={form.caseType}
                  onChange={(e) => setForm({ ...form, caseType: e.target.value })}
                  placeholder="Stolen vehicle" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="expiresAt">Expires</label>
                <input id="expiresAt" type="date" value={form.expiresAt ?? ''}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className={inputClass} />
                <p className="text-[11px] text-ai-gray-600 mt-1.5">Blank means it stays active until paused.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="notes">Notes</label>
                <textarea id="notes" rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={inputClass} />
              </div>
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
                {editing ? 'Save changes' : 'Add to watchlist'}
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {isImportOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl my-8 bg-ai-dark border border-ai-gray-800 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-ai-white">Import a stolen-vehicle list</h2>
                <p className="text-xs text-ai-gray-500 mt-1">
                  Required columns: plateNumber, caseNumber, caseType. Optional: vehicleMakeModel,
                  color, severity, expiresAt, notes.
                </p>
              </div>
              <button type="button" onClick={() => setIsImportOpen(false)} aria-label="Close"
                className="icon-btn p-2 rounded-lg text-ai-gray-400 hover:text-ai-white hover:bg-ai-gray-900 transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              spellCheck={false}
              className={`${inputClass} font-mono text-xs`}
            />

            {importError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 break-anywhere">
                {importError}
              </div>
            )}

            {/* Per-row outcomes. A caller who pastes 500 plates needs to know which
                lines were rejected and why, not just that most succeeded. */}
            {importResult && (
              <div className="mt-4 p-3 rounded-lg bg-ai-gray-900/70 border border-ai-gray-800 text-sm">
                <p className="text-ai-white mb-2">
                  {importResult.imported} imported, {importResult.rejected} rejected.
                </p>
                {importResult.rejections.length > 0 && (
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {importResult.rejections.map((rejection) => (
                      <li key={rejection.line} className="text-xs text-red-300 break-anywhere">
                        line {rejection.line}: {rejection.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setIsImportOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors text-sm">
                Close
              </button>
              <button type="button" onClick={runImport} disabled={importing}
                className="px-5 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {importing && <Loader className="w-4 h-4 animate-spin" />}
                Import
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;
