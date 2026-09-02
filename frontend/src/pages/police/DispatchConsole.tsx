import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Siren, Radio, RefreshCw, Loader, AlertTriangle, MapPin, Camera as CameraIcon,
  CheckCircle2, Send, Clock, WifiOff, Wifi, X,
} from 'lucide-react';
import MeshGradient from '../../components/MeshGradient';
import Spotlight from '../../components/Spotlight';
import Navbar from '../../components/Navbar';
import {
  dispatchService, formatDistance, formatDuration,
  type EstateIncident, type RankedUnit, type DispatchAssignment, type DispatchStats,
} from '../../services/dispatch.service';
import { getSocket, onRealtime, type RealtimeStatus } from '../../lib/socket';
import {
  severityOf, STATUS_LABEL, DISPATCH_STATUS_LABEL, RULE_EXPLANATION,
  sourceLabel, relativeTime, queueOrder,
} from './incidentPresentation';

// ============================================================================
// The police dispatch console.
//
// This is the operational half of the POLICE role: one queue of every incident
// across the estate, and the ability to send a unit to any of them.
//
// Honesty rules this page is built around, all of which the page it descends
// from broke:
//   - No ETA is displayed unless a routing service computed one. Distances are
//     straight-line haversines and are labelled as such.
//   - No timer resolves anything. An incident closes when a person closes it.
//   - "Not yet measured" is printed wherever a mean has no samples. Zero is
//     never used to mean "none".
//   - An empty queue is rendered as an empty queue, with the reason.
// ============================================================================

// Realtime is the fast path; this poll is the floor that guarantees correctness
// if a frame is missed or the socket never connects.
const POLL_MS = 15000;

type StatusFilter = 'active' | 'open' | 'investigating' | 'resolved' | 'all';
type ScopeFilter = 'all' | 'estate' | 'event';
type SourceFilter = 'all' | 'anomaly' | 'manual';

const DispatchConsole: React.FC = () => {
  const [incidents, setIncidents] = useState<EstateIncident[]>([]);
  const [stats, setStats] = useState<DispatchStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [units, setUnits] = useState<RankedUnit[]>([]);
  const [rankedByDistance, setRankedByDistance] = useState(true);
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<RealtimeStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Read inside socket handlers without making them a dependency of the effect.
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  const loadIncidents = useCallback(async () => {
    try {
      const filters: Record<string, string> = {};
      if (statusFilter === 'open' || statusFilter === 'investigating' || statusFilter === 'resolved') {
        filters.status = statusFilter;
      }
      if (scopeFilter !== 'all') filters.scope = scopeFilter;
      if (sourceFilter !== 'all') filters.source = sourceFilter;

      const { data } = await dispatchService.getEstateIncidents(filters);

      // 'active' is a client-side view over the two unresolved states rather
      // than a server filter, so it stays one request.
      const visible = statusFilter === 'active' ? data.filter((i) => i.status !== 'resolved') : data;

      setIncidents(visible.sort(queueOrder));
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Could not load the incident queue');
    }
  }, [statusFilter, scopeFilter, sourceFilter]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await dispatchService.getStats());
    } catch {
      // A failed stats read must not blank the queue, which is the part an
      // operator actually needs. The tiles simply keep their last value.
    }
  }, []);

  const loadPanel = useCallback(async (incidentId: string) => {
    setPanelLoading(true);
    try {
      const [ranked, existing] = await Promise.all([
        dispatchService.getUnitsForIncident(incidentId),
        dispatchService.getAssignments(incidentId),
      ]);
      setUnits(ranked.units);
      setRankedByDistance(ranked.rankedByDistance);
      setAssignments(existing);
      setActionError(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not load dispatch options');
    } finally {
      setPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadIncidents(), loadStats()]).finally(() => setLoading(false));
  }, [loadIncidents, loadStats]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadIncidents();
      void loadStats();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadIncidents, loadStats]);

  useEffect(() => {
    if (selectedId) void loadPanel(selectedId);
  }, [selectedId, loadPanel]);

  // ------------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------------

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setRealtime('disconnected');
      return;
    }

    const onConnect = () => setRealtime('connected');
    const onDisconnect = () => setRealtime('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    if (socket.connected) setRealtime('connected');

    // A frame means "something changed, read it again" rather than carrying the
    // new state itself. The REST read stays the single source of truth, so a
    // malformed or partial payload can never corrupt the queue.
    const refresh = () => {
      void loadIncidents();
      void loadStats();
      const open = selectedIdRef.current;
      if (open) void loadPanel(open);
    };

    const offs = [
      onRealtime('incident:new', refresh),
      onRealtime('incident:updated', refresh),
      onRealtime('dispatch:new', refresh),
      onRealtime('dispatch:updated', refresh),
    ];

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      offs.forEach((off) => off());
    };
  }, [loadIncidents, loadStats, loadPanel]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId]
  );

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await action();
      await Promise.all([loadIncidents(), loadStats()]);
      if (selectedIdRef.current) await loadPanel(selectedIdRef.current);
    } catch (err: any) {
      // A failed dispatch is shown, never swallowed while the UI moves on.
      setActionError(err?.response?.data?.message || err.message || 'That action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const openCount = incidents.filter((i) => i.status !== 'resolved').length;
  const anomalyCount = incidents.filter((i) => i.source === 'anomaly' && i.status !== 'resolved').length;

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Siren className="w-7 h-7 sm:w-8 sm:h-8 text-ai-white shrink-0" />
                <h1 className="text-heading text-2xl sm:text-3xl font-bold text-ai-white">
                  Dispatch Console
                </h1>
              </div>
              <p className="text-ai-gray-400 text-sm sm:text-base">
                Every incident across the estate, and the units that can answer it.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Says plainly whether pushes are arriving. An operator must know
                  whether they are looking at a live feed or a 15-second poll. */}
              <div className="flex items-center gap-2 text-xs text-ai-gray-400">
                {realtime === 'connected' ? (
                  <>
                    <Wifi className="w-4 h-4 text-ai-white" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Polling every {POLL_MS / 1000}s</span>
                  </>
                )}
              </div>

              <button
                onClick={() => void Promise.all([loadIncidents(), loadStats()])}
                className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </motion.div>

          {/* Counters. Every one is a COUNT or a mean over rows that exist. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
          >
            <div className="glass-light rounded-2xl p-4">
              <p className="text-xs text-ai-gray-400 mb-1">Open incidents</p>
              <p className="text-2xl font-bold text-ai-white">{openCount}</p>
              <p className="text-xs text-ai-gray-500 mt-1">
                {anomalyCount} raised by rules
              </p>
            </div>

            <div className="glass-light rounded-2xl p-4">
              <p className="text-xs text-ai-gray-400 mb-1">Units available</p>
              <p className="text-2xl font-bold text-ai-white">{stats?.units.available ?? 0}</p>
              <p className="text-xs text-ai-gray-500 mt-1">
                {stats?.units.dispatched ?? 0} committed · {stats?.units.offline ?? 0} offline
              </p>
            </div>

            <div className="glass-light rounded-2xl p-4">
              <p className="text-xs text-ai-gray-400 mb-1">Mean acknowledgement</p>
              {stats?.meanAcknowledgeSeconds !== null && stats?.meanAcknowledgeSeconds !== undefined ? (
                <>
                  <p className="text-2xl font-bold text-ai-white">
                    {formatDuration(stats.meanAcknowledgeSeconds)}
                  </p>
                  <p className="text-xs text-ai-gray-500 mt-1">
                    over {stats.measuredFrom.acknowledgements} acknowledgement
                    {stats.measuredFrom.acknowledgements === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <>
                  {/* Null, not zero. Zero would read as "instant". */}
                  <p className="text-base font-semibold text-ai-gray-500">Not yet measured</p>
                  <p className="text-xs text-ai-gray-500 mt-1">no unit has acknowledged yet</p>
                </>
              )}
            </div>

            <div className="glass-light rounded-2xl p-4">
              <p className="text-xs text-ai-gray-400 mb-1">Mean time on scene</p>
              {stats?.meanArrivalSeconds !== null && stats?.meanArrivalSeconds !== undefined ? (
                <>
                  <p className="text-2xl font-bold text-ai-white">
                    {formatDuration(stats.meanArrivalSeconds)}
                  </p>
                  <p className="text-xs text-ai-gray-500 mt-1">
                    over {stats.measuredFrom.arrivals} arrival
                    {stats.measuredFrom.arrivals === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-ai-gray-500">Not yet measured</p>
                  <p className="text-xs text-ai-gray-500 mt-1">no unit has reported arrival</p>
                </>
              )}
            </div>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <FilterGroup
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                ['active', 'Active'],
                ['open', 'Open'],
                ['investigating', 'Investigating'],
                ['resolved', 'Resolved'],
                ['all', 'All'],
              ]}
            />
            <FilterGroup
              label="Scope"
              value={scopeFilter}
              onChange={(v) => setScopeFilter(v as ScopeFilter)}
              options={[
                ['all', 'All'],
                ['estate', 'Estate cameras'],
                ['event', 'Events'],
              ]}
            />
            <FilterGroup
              label="Source"
              value={sourceFilter}
              onChange={(v) => setSourceFilter(v as SourceFilter)}
              options={[
                ['all', 'All'],
                ['anomaly', 'Rule engine'],
                ['manual', 'Reported'],
              ]}
            />
          </div>

          {error && (
            <div className="glass-light rounded-2xl p-4 mb-4 border border-ai-white/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-ai-white shrink-0 mt-0.5" />
              <p className="text-sm text-ai-gray-200">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* --- Queue ------------------------------------------------ */}
            <div className="lg:col-span-3 space-y-3">
              {loading ? (
                <div className="glass-light rounded-2xl p-12 flex items-center justify-center">
                  <Loader className="w-6 h-6 animate-spin text-ai-gray-400" />
                </div>
              ) : incidents.length === 0 ? (
                <EmptyQueue stats={stats} statusFilter={statusFilter} />
              ) : (
                incidents.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    selected={incident.id === selectedId}
                    onSelect={() => setSelectedId(incident.id)}
                  />
                ))
              )}

              {lastUpdated && (
                <p className="text-xs text-ai-gray-600 pt-2">
                  Queue read at {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* --- Detail / dispatch panel ------------------------------ */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 space-y-4">
                {!selected ? (
                  <div className="glass-light rounded-2xl p-6 text-center">
                    <Radio className="w-8 h-8 text-ai-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-ai-gray-400">
                      Select an incident to see the units that can answer it.
                    </p>
                  </div>
                ) : (
                  <DispatchPanel
                    incident={selected}
                    units={units}
                    rankedByDistance={rankedByDistance}
                    assignments={assignments}
                    loading={panelLoading}
                    busyAction={busyAction}
                    error={actionError}
                    onClose={() => setSelectedId(null)}
                    onDispatch={(unitId) =>
                      runAction(`dispatch:${unitId}`, () =>
                        dispatchService.dispatchUnit(selected.id, unitId)
                      )
                    }
                    onAdvance={(assignmentId, action) =>
                      runAction(`advance:${assignmentId}:${action}`, () =>
                        dispatchService.advanceAssignment(assignmentId, action)
                      )
                    }
                    onResolve={() =>
                      runAction('resolve', () =>
                        dispatchService.updateIncidentStatus(selected.id, 'resolved')
                      )
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const FilterGroup: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}> = ({ label, value, onChange, options }) => (
  <div className="flex items-center gap-1.5 glass-light rounded-xl px-2 py-1.5">
    <span className="text-[11px] uppercase tracking-wide text-ai-gray-500 px-1">{label}</span>
    {options.map(([key, text]) => (
      <button
        key={key}
        onClick={() => onChange(key)}
        className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
          value === key
            ? 'bg-ai-white text-ai-black font-medium'
            : 'text-ai-gray-400 hover:text-ai-gray-200'
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

const IncidentCard: React.FC<{
  incident: EstateIncident;
  selected: boolean;
  onSelect: () => void;
}> = ({ incident, selected, onSelect }) => {
  const severity = severityOf(incident.severity);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left glass-light rounded-2xl p-4 border transition-colors ${
        selected ? 'border-ai-white' : `${severity.border} hover:border-ai-gray-600`
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${severity.chip}`}>
            {severity.label}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] bg-ai-gray-900 text-ai-gray-400 border border-ai-gray-800">
            {STATUS_LABEL[incident.status]}
          </span>
          {incident.source === 'anomaly' && (
            <span className="px-2 py-0.5 rounded-md text-[11px] bg-ai-gray-900 text-ai-gray-300 border border-ai-gray-700">
              Rule engine
            </span>
          )}
        </div>
        <span className="text-[11px] text-ai-gray-500 shrink-0" title={new Date(incident.timestamp).toLocaleString()}>
          {relativeTime(incident.timestamp)}
        </span>
      </div>

      <p className="text-sm text-ai-white mb-2 line-clamp-2">{incident.description}</p>

      <div className="flex items-center gap-3 flex-wrap text-[11px] text-ai-gray-500">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {incident.location}
        </span>
        {incident.camera && (
          <span className="flex items-center gap-1">
            <CameraIcon className="w-3 h-3" />
            {incident.camera.cameraId}
          </span>
        )}
        {incident.eventName && <span>Event · {incident.eventName}</span>}
        {incident.activeAssignments.length > 0 && (
          <span className="text-ai-gray-300">
            {incident.activeAssignments.length} unit
            {incident.activeAssignments.length === 1 ? '' : 's'} committed
          </span>
        )}
      </div>
    </button>
  );
};

const EmptyQueue: React.FC<{ stats: DispatchStats | null; statusFilter: string }> = ({
  stats,
  statusFilter,
}) => {
  const anomalies = stats?.anomalies;
  const inactive = anomalies?.rules.filter((r) => !r.active) ?? [];

  return (
    <div className="glass-light rounded-2xl p-8 text-center">
      <CheckCircle2 className="w-8 h-8 text-ai-gray-600 mx-auto mb-3" />
      <p className="text-sm text-ai-gray-300 mb-1">
        {statusFilter === 'resolved' ? 'No resolved incidents.' : 'Nothing in the queue.'}
      </p>

      {/* An empty queue can mean "nothing is wrong" or "nothing is being
          watched". Those are very different, so the page says which. */}
      {anomalies && (
        <div className="mt-4 text-xs text-ai-gray-500 space-y-1">
          <p>
            {anomalies.camerasProbed} camera
            {anomalies.camerasProbed === 1 ? ' has' : 's have'} been probed ·{' '}
            {anomalies.densityReadings} crowd reading
            {anomalies.densityReadings === 1 ? '' : 's'} recorded
          </p>
          {inactive.length > 0 && (
            <p>
              Dormant rules: {inactive.map((r) => `${r.key} (needs ${r.requires})`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const DispatchPanel: React.FC<{
  incident: EstateIncident;
  units: RankedUnit[];
  rankedByDistance: boolean;
  assignments: DispatchAssignment[];
  loading: boolean;
  busyAction: string | null;
  error: string | null;
  onClose: () => void;
  onDispatch: (unitId: string) => void;
  onAdvance: (assignmentId: string, action: 'acknowledge' | 'arrive' | 'clear' | 'cancel') => void;
  onResolve: () => void;
}> = ({
  incident, units, rankedByDistance, assignments, loading, busyAction, error,
  onClose, onDispatch, onAdvance, onResolve,
}) => {
  const severity = severityOf(incident.severity);
  const live = assignments.filter((a) => !['cleared', 'cancelled'].includes(a.status));

  return (
    <>
      <div className="glass-light rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${severity.chip}`}>
            {severity.label}
          </span>
          <button onClick={onClose} className="text-ai-gray-500 hover:text-ai-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-ai-white mb-3">{incident.description}</p>

        <dl className="space-y-2 text-xs">
          <Row label="Location" value={incident.location} />
          <Row
            label="Raised"
            value={`${new Date(incident.timestamp).toLocaleString()} (${relativeTime(incident.timestamp)})`}
          />
          <Row label="Source" value={sourceLabel(incident)} />
          {incident.camera && (
            <Row label="Camera" value={`${incident.camera.cameraId} — ${incident.camera.name}`} />
          )}
          {incident.site && <Row label="Site" value={incident.site.name} />}
          {incident.eventName && <Row label="Event" value={incident.eventName} />}
          <Row
            label="Position"
            value={
              incident.latitude !== null && incident.longitude !== null
                ? `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`
                : 'Not surveyed'
            }
          />
          {/* Only ever the detector's own number. Absent means no detector ran. */}
          {incident.detectionConfidence !== null && (
            <Row
              label="Detector confidence"
              value={`${Math.round(incident.detectionConfidence * 100)}%`}
            />
          )}
        </dl>

        {incident.source === 'anomaly' && incident.ruleKey && RULE_EXPLANATION[incident.ruleKey] && (
          <p className="mt-3 pt-3 border-t border-ai-gray-800 text-[11px] text-ai-gray-500">
            {RULE_EXPLANATION[incident.ruleKey]}
          </p>
        )}

        {incident.status !== 'resolved' && (
          <button
            onClick={onResolve}
            disabled={busyAction === 'resolve'}
            className="mt-4 w-full px-4 py-2.5 rounded-xl bg-ai-white text-ai-black hover:bg-ai-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            {busyAction === 'resolve' ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Mark resolved
          </button>
        )}
      </div>

      {error && (
        <div className="glass-light rounded-2xl p-4 border border-ai-white/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-ai-white shrink-0 mt-0.5" />
          <p className="text-sm text-ai-gray-200">{error}</p>
        </div>
      )}

      {/* --- Committed units --------------------------------------- */}
      {live.length > 0 && (
        <div className="glass-light rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-ai-white mb-3">On this incident</h3>
          <div className="space-y-3">
            {live.map((assignment) => (
              <div key={assignment.id} className="border border-ai-gray-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm text-ai-white">{assignment.unit?.name}</p>
                  <span className="px-2 py-0.5 rounded-md text-[11px] bg-ai-gray-900 text-ai-gray-300 border border-ai-gray-700 shrink-0">
                    {DISPATCH_STATUS_LABEL[assignment.status]}
                  </span>
                </div>

                <p className="text-[11px] text-ai-gray-500 mb-2">
                  Sent {relativeTime(assignment.dispatchedAt)}
                  {assignment.dispatcherName ? ` by ${assignment.dispatcherName}` : ''}
                  {assignment.acknowledgedInSeconds !== null &&
                    ` · acknowledged in ${formatDuration(assignment.acknowledgedInSeconds)}`}
                  {assignment.arrivedInSeconds !== null &&
                    ` · on scene in ${formatDuration(assignment.arrivedInSeconds)}`}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {assignment.status === 'dispatched' && (
                    <ActionButton
                      label="Acknowledge"
                      busy={busyAction === `advance:${assignment.id}:acknowledge`}
                      onClick={() => onAdvance(assignment.id, 'acknowledge')}
                    />
                  )}
                  {['dispatched', 'acknowledged'].includes(assignment.status) && (
                    <ActionButton
                      label="On scene"
                      busy={busyAction === `advance:${assignment.id}:arrive`}
                      onClick={() => onAdvance(assignment.id, 'arrive')}
                    />
                  )}
                  <ActionButton
                    label="Clear"
                    busy={busyAction === `advance:${assignment.id}:clear`}
                    onClick={() => onAdvance(assignment.id, 'clear')}
                  />
                  <ActionButton
                    label="Cancel"
                    busy={busyAction === `advance:${assignment.id}:cancel`}
                    onClick={() => onAdvance(assignment.id, 'cancel')}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Available units --------------------------------------- */}
      <div className="glass-light rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-ai-white">Send a unit</h3>
          {loading && <Loader className="w-4 h-4 animate-spin text-ai-gray-500" />}
        </div>

        {/* States plainly what the ordering is based on. The distance is a
            straight line, and calling it anything else would be the same
            mistake as the random ETA this replaced. */}
        <p className="text-[11px] text-ai-gray-500 mb-3">
          {rankedByDistance
            ? 'Nearest first, by straight-line distance from the incident. Road distance and ETA are not computed.'
            : 'This incident has no surveyed position, so units cannot be ranked by distance.'}
        </p>

        {units.length === 0 && !loading ? (
          <p className="text-sm text-ai-gray-400">
            No dispatch units are registered for this jurisdiction.
          </p>
        ) : (
          <div className="space-y-2 max-h-[22rem] overflow-y-auto">
            {units.map((unit) => {
              const committed = live.some((a) => a.unitId === unit.id);
              const distance = formatDistance(unit.straightLineM);

              return (
                <div
                  key={unit.id}
                  className="flex items-center justify-between gap-3 border border-ai-gray-800 rounded-xl p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ai-white truncate">{unit.name}</p>
                    <p className="text-[11px] text-ai-gray-500 truncate">
                      {unit.type} · {unit.department?.name ?? 'No department'}
                    </p>
                    <p className="text-[11px] text-ai-gray-500">
                      {distance ?? 'Distance unknown — unit not surveyed'}
                      {' · '}
                      {unit.status === 'available' ? 'Available' : `Status: ${unit.status}`}
                      {/* Never an invented ETA. */}
                      {' · ETA unavailable'}
                    </p>
                  </div>

                  <button
                    onClick={() => onDispatch(unit.id)}
                    disabled={committed || busyAction === `dispatch:${unit.id}` || unit.status === 'offline'}
                    className="px-3 py-1.5 rounded-lg bg-ai-white text-ai-black text-xs font-medium hover:bg-ai-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                  >
                    {busyAction === `dispatch:${unit.id}` ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    {committed ? 'Sent' : 'Dispatch'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-3">
    <dt className="text-ai-gray-500 w-28 shrink-0">{label}</dt>
    <dd className="text-ai-gray-200 min-w-0 break-words">{value}</dd>
  </div>
);

const ActionButton: React.FC<{ label: string; busy: boolean; onClick: () => void }> = ({
  label, busy, onClick,
}) => (
  <button
    onClick={onClick}
    disabled={busy}
    className="px-2.5 py-1 rounded-lg border border-ai-gray-700 text-ai-gray-200 hover:bg-ai-gray-900 transition-colors text-[11px] disabled:opacity-50 flex items-center gap-1"
  >
    {busy ? <Loader className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
    {label}
  </button>
);

export default DispatchConsole;
