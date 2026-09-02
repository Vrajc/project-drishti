import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ShieldAlert, Loader, AlertTriangle, CheckCircle, Send, XCircle, Archive, RefreshCw,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import { onRealtime } from '../../lib/socket';
import * as watchlist from '../../services/watchlist.service';
import type { Alert, AlertCounts, AlertStatus } from '../../services/watchlist.service';

const SNAPSHOT_BASE = import.meta.env.VITE_SNAPSHOT_BASE_URL || '';

const STATUS_PILL: Record<AlertStatus, string> = {
  NEW: 'bg-red-500/15 text-red-300 border-red-500/30',
  ACKNOWLEDGED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DISPATCHED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  CLOSED: 'bg-ai-gray-800 text-ai-gray-300 border-ai-gray-700',
  FALSE_POSITIVE: 'bg-ai-gray-800 text-ai-gray-500 border-ai-gray-700',
};

const STATUS_LABEL: Record<AlertStatus, string> = {
  NEW: 'new',
  ACKNOWLEDGED: 'acknowledged',
  DISPATCHED: 'dispatched',
  CLOSED: 'closed',
  FALSE_POSITIVE: 'false positive',
};

const AlertsConsole: React.FC = () => {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [list, countRow] = await Promise.all([
        watchlist.getAlerts({ status: statusFilter || undefined, take: 100 }),
        watchlist.getAlertCounts(),
      ]);
      setAlerts(list.data);
      setCounts(countRow);
    } catch (error: any) {
      setAlerts([]);
      setCounts(null);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live pushes from the match engine, with a poll behind them so a dropped
  // socket degrades to slower updates rather than a console that silently stops.
  useEffect(() => {
    const offNew = onRealtime('alert:new', () => void load());
    const offUpdated = onRealtime('alert:updated', () => void load());
    const interval = setInterval(() => void load(), 20000);
    return () => {
      offNew();
      offUpdated();
      clearInterval(interval);
    };
  }, [load]);

  const setStatus = async (alert: Alert, status: AlertStatus) => {
    setBusyId(alert.id);
    setActionError(null);
    try {
      await watchlist.setAlertStatus(alert.id, status);
      await load();
    } catch (error: any) {
      setActionError(`Could not update ${alert.watchlistEntry.caseNumber}: ${error.message}`);
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Why the console is empty, when it is.
   *
   * "No alerts" means one of several very different things, and an operator
   * needs to know which. Nothing here guesses: each sentence is derived from a
   * counter the server actually reports.
   */
  const emptyExplanation = useMemo(() => {
    if (!counts) return null;
    if (counts.total > 0) return null;

    if (!counts.engine.running) {
      return 'The match engine is not running, so nothing is being compared against the watchlist.';
    }
    if (!counts.engine.connected) {
      return (
        'The match engine cannot reach Redis, so no detections are arriving. ' +
        (counts.engine.lastError ? `Last error: ${counts.engine.lastError}` : '')
      );
    }
    if (counts.watchlistActive === 0) {
      return 'Nothing is on the watchlist yet, so there is nothing to match against.';
    }
    if (counts.platesReadable === 0) {
      return (
        'No plate has been read yet. Plate reading is off unless the analytics service has a ' +
        'plate detector configured (PLATE_MODEL_PATH), so no plate can be compared.'
      );
    }
    return 'Plates are being read and compared, and none has matched the watchlist.';
  }, [counts]);

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
                <Bell className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">Alerts</h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                {counts
                  ? `${counts.unhandled} unhandled of ${counts.total}, against ${counts.watchlistActive} active watchlist entr${counts.watchlistActive === 1 ? 'y' : 'ies'}.`
                  : 'Loading…'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => navigate('/police/watchlist')}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm">
                <ShieldAlert className="w-4 h-4" />
                Watchlist
              </button>
              <button onClick={() => void load()}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </motion.div>

          <div className="glass-light rounded-2xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-ai-gray-900 border border-ai-gray-700 rounded-lg text-sm text-ai-white focus:outline-none focus:border-ai-gray-400"
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABEL) as AlertStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_LABEL[status]}</option>
              ))}
            </select>

            {counts && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 lg:ml-auto text-xs text-ai-gray-400">
                {(Object.keys(STATUS_LABEL) as AlertStatus[]).map((status) => (
                  <span key={status}>{STATUS_LABEL[status]}: {counts.byStatus[status] ?? 0}</span>
                ))}
                {/* What the pipeline is actually doing, so an empty console is
                    never mistaken for a quiet night. */}
                <span className="text-ai-gray-500">
                  engine {counts.engine.running ? (counts.engine.connected ? 'connected' : 'retrying') : 'stopped'}
                  {' · '}plates read {counts.engine.platesSeen}
                </span>
              </div>
            )}
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-sm text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-anywhere">{actionError}</span>
            </div>
          )}

          {loadError && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-sm text-red-200">
              <p className="font-medium mb-1">Alerts could not be loaded.</p>
              <p className="text-xs break-anywhere">{loadError}</p>
            </div>
          )}

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-ai-gray-400">
              <Loader className="w-6 h-6 animate-spin mb-2" />Loading alerts…
            </div>
          ) : alerts.length === 0 ? (
            <div className="glass-light rounded-2xl py-16 px-6 text-center">
              <Bell className="w-8 h-8 text-ai-gray-500 mx-auto mb-3" />
              <p className="text-ai-gray-300 mb-2">No alerts.</p>
              {emptyExplanation && (
                <p className="text-ai-gray-500 text-sm max-w-xl mx-auto break-anywhere">{emptyExplanation}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-light rounded-2xl p-4 flex flex-col lg:flex-row gap-4"
                >
                  {/* The frame the match was made on. An operator checks the
                      machine here rather than taking its word. */}
                  <div className="w-full lg:w-56 shrink-0">
                    {alert.detection.snapshotPath ? (
                      <img
                        src={`${SNAPSHOT_BASE}${alert.detection.snapshotPath}`}
                        alt={`Detection on ${alert.camera.name}`}
                        className="w-full aspect-video object-cover rounded-lg bg-ai-gray-900"
                        onError={(event) => {
                          // The row records a path; whether the file is reachable
                          // from this browser is a separate question, and it says
                          // so rather than showing a broken image icon.
                          const target = event.currentTarget;
                          target.style.display = 'none';
                          target.insertAdjacentHTML(
                            'afterend',
                            '<div class="w-full aspect-video rounded-lg bg-ai-gray-900 border border-ai-gray-800 flex items-center justify-center text-[11px] text-ai-gray-500 px-3 text-center">Snapshot recorded but not reachable from this browser</div>'
                          );
                        }}
                      />
                    ) : (
                      <div className="w-full aspect-video rounded-lg bg-ai-gray-900 border border-ai-gray-800 flex items-center justify-center text-[11px] text-ai-gray-500 px-3 text-center">
                        No snapshot was stored for this detection
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-lg font-bold text-ai-white">
                        {alert.watchlistEntry.plateNumber ?? alert.watchlistEntry.personName}
                      </span>
                      <span className={`px-2 py-0.5 rounded border text-xs ${STATUS_PILL[alert.status]}`}>
                        {STATUS_LABEL[alert.status]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-xs ${
                          alert.matchType === 'PLATE_EXACT'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {alert.matchType === 'PLATE_EXACT' ? 'exact match' : 'probable match'}
                        {' · '}
                        {/* Computed from the edit distance between the normalised
                            plates, not a confidence the system chose. */}
                        {(alert.matchScore * 100).toFixed(0)}%
                      </span>
                    </div>

                    <p className="text-sm text-ai-gray-300 mb-1">
                      {alert.watchlistEntry.caseType} · {alert.watchlistEntry.caseNumber}
                      {alert.watchlistEntry.vehicleMakeModel ? ` · ${alert.watchlistEntry.vehicleMakeModel}` : ''}
                    </p>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
                      <div>
                        <dt className="text-ai-gray-500">Camera</dt>
                        <dd className="text-ai-gray-200 truncate">{alert.camera.name}</dd>
                      </div>
                      <div>
                        <dt className="text-ai-gray-500">Seen at</dt>
                        <dd className="text-ai-gray-200">{new Date(alert.ts).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-ai-gray-500">Plate read as</dt>
                        <dd className="text-ai-gray-200">{alert.detection.plateNumber ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-ai-gray-500">OCR confidence</dt>
                        <dd className="text-ai-gray-200">
                          {alert.detection.plateConfidence === null
                            ? '—'
                            : `${(alert.detection.plateConfidence * 100).toFixed(0)}%`}
                        </dd>
                      </div>
                    </dl>

                    {alert.acknowledger && (
                      <p className="text-[11px] text-ai-gray-600 mt-2">
                        First handled by {alert.acknowledger.name}
                        {alert.acknowledgedAt ? ` at ${new Date(alert.acknowledgedAt).toLocaleString()}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex lg:flex-col gap-2 shrink-0">
                    {([
                      ['ACKNOWLEDGED', CheckCircle, 'Acknowledge'],
                      ['DISPATCHED', Send, 'Dispatch'],
                      ['FALSE_POSITIVE', XCircle, 'False positive'],
                      ['CLOSED', Archive, 'Close'],
                    ] as Array<[AlertStatus, any, string]>).map(([status, Icon, label]) => (
                      <button
                        key={status}
                        onClick={() => setStatus(alert, status)}
                        disabled={busyId === alert.id || alert.status === status}
                        className="px-3 py-2 rounded-lg border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors text-xs flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
                      >
                        {busyId === alert.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsConsole;
