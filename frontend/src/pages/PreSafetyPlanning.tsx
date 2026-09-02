import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, Info, Sparkles, Loader, Calculator, MapPin,
} from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { analyzeSafetyPlanning } from '../services/ai.service';
import {
  buildSafetyPlan, DEFAULT_ASSUMPTIONS, type PlanningAssumptions,
} from '../utils/safetyPlan';

/**
 * Pre-event safety planning.
 *
 * This page used to send the event's name, type, attendance and zone names to a
 * language model and print the numbers it returned as recommendations:
 * "Emergency Exits: 5, critical", "Security Cameras: 20", "Crowd Control
 * Barriers: 35", each with a list of positions. Ask twice, get different
 * numbers. The model had no venue geometry, no exit widths and no capacity
 * model, so those were plausible-sounding guesses printed as engineering
 * figures for an organizer to act on. The control panel above them ticked off
 * "Crowd Flow Simulation" and "Venue Layout Analysis" as though they had run.
 *
 * The provision figures are now arithmetic over the numbers the organizer
 * entered, each shown with the calculation that produced it, and the checks
 * that need no assumption at all - zone capacity against expected attendance,
 * cameras against zones - are stated first. The model is still here, below the
 * figures and clearly separated: it writes commentary, not measurements.
 */
const PreSafetyPlanning: React.FC = () => {
  const { event } = useEvent();
  const navigate = useNavigate();
  const toast = useToast();

  const [assumptions, setAssumptions] = useState<PlanningAssumptions>(DEFAULT_ASSUMPTIONS);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const zones = useMemo(
    () => (event?.zones ?? []).map((zone) => ({ name: zone.name, maxCapacity: zone.maxCapacity })),
    [event]
  );

  const plan = useMemo(
    () =>
      buildSafetyPlan(
        {
          attendance: event?.crowdSize ?? 0,
          zones,
          camerasAssigned: event?.cameras?.length ?? 0,
          dispatchUnits: event?.dispatchUnits?.length ?? 0,
        },
        assumptions
      ),
    [event, zones, assumptions]
  );

  const requestNotes = async () => {
    if (!event) return;
    if (zones.length === 0) {
      toast.error(
        'This event has no zones',
        'Add zones with capacities in event setup so there is a layout to comment on.'
      );
      return;
    }

    setNotesLoading(true);
    try {
      const result = await analyzeSafetyPlanning({
        name: event.name,
        type: event.type || 'General Event',
        expectedAttendance: event.crowdSize || 0,
        venue: event.location || '',
        duration: 'not recorded',
        zones: zones.map((zone) => zone.name),
      });

      // The endpoint returns structured "recommendations" with counts. Only the
      // prose is used: the counts came from the same model that has never seen
      // the venue, and the figures above are computed from real numbers.
      const analysis: any = result?.analysis;
      const prose =
        typeof analysis === 'string'
          ? analysis
          : (analysis?.summary ??
            (Array.isArray(analysis?.recommendations)
              ? analysis.recommendations
                  .map((rec: any) => `• ${rec.title}: ${rec.description}`)
                  .join('\n')
              : null));

      if (!prose) {
        toast.info('No commentary returned', 'The figures above are unaffected.');
        setNotes(null);
      } else {
        setNotes(prose);
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.details ??
        error?.response?.data?.message ??
        error?.message ??
        'The analysis service did not answer';
      toast.error('Commentary could not be generated', detail);
    } finally {
      setNotesLoading(false);
    }
  };

  const severityStyle: Record<string, string> = {
    critical: 'border-red-500/50 bg-red-500/5',
    warning: 'border-amber-500/40 bg-amber-500/5',
    info: 'border-ai-gray-700 bg-transparent',
  };

  const severityIcon: Record<string, typeof Info> = {
    critical: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-12"
          >
            <Shield className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 text-ai-white">
              Pre-Event Safety Planning
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base lg:text-lg max-w-3xl mx-auto">
              Provision sized from the numbers recorded for this event, with the calculation shown
              for each figure.
            </p>
          </motion.div>

          {!event ? (
            <div className="glass-light rounded-2xl p-8 sm:p-12 text-center">
              <p className="text-ai-white font-medium mb-1">No event selected</p>
              <p className="text-sm text-ai-gray-400">
                Choose an event to plan its safety provision.
              </p>
            </div>
          ) : (
            <>
              {/* What the figures are computed from */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
              >
                <h3 className="text-base sm:text-lg font-semibold text-white mb-4">
                  What this is based on
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
                  {[
                    { label: 'Event', value: event.name },
                    { label: 'Expected attendees', value: event.crowdSize?.toLocaleString() ?? '—' },
                    { label: 'Zones', value: zones.length },
                    {
                      label: 'Declared zone capacity',
                      value: plan.declaredZoneCapacity.toLocaleString(),
                    },
                    { label: 'Cameras assigned', value: event.cameras?.length ?? 0 },
                  ].map((tile) => (
                    <div key={tile.label}>
                      <div className="text-base sm:text-xl font-bold text-ai-white break-anywhere">
                        {tile.value}
                      </div>
                      <div className="text-xs text-ai-gray-400">{tile.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Findings first: these need no assumption at all */}
              {plan.findings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 mb-6"
                >
                  <h3 className="text-lg font-semibold text-white">Findings</h3>
                  {plan.findings.map((finding) => {
                    const Icon = severityIcon[finding.severity];
                    return (
                      <div
                        key={finding.title}
                        className={`rounded-xl border p-4 ${severityStyle[finding.severity]}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon
                            className={`w-5 h-5 shrink-0 mt-0.5 ${
                              finding.severity === 'critical'
                                ? 'text-red-400'
                                : finding.severity === 'warning'
                                  ? 'text-amber-400'
                                  : 'text-ai-gray-400'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ai-white">{finding.title}</p>
                            <p className="text-sm text-ai-gray-400 mt-1 break-anywhere">
                              {finding.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* The computed provision */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-5 h-5 text-ai-white" />
                  <h3 className="text-lg font-semibold text-white">Provision</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.figures.map((figure) => (
                    <div key={figure.key} className="glass-light rounded-2xl p-5">
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <h4 className="text-sm font-medium text-ai-gray-300">{figure.label}</h4>
                        <div className="text-2xl font-bold text-ai-white shrink-0">
                          {figure.value === null ? '—' : figure.value.toLocaleString()}
                        </div>
                      </div>
                      <p className="text-xs text-ai-gray-500 break-anywhere">{figure.basis}</p>
                      {figure.assumption && (
                        <p className="text-xs text-ai-gray-600 mt-2">
                          Assumes {figure.assumption}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-ai-gray-600 mt-4 max-w-3xl">
                  These are planning figures derived from the numbers above, not a compliance
                  calculation. Licensing conditions, occupancy limits and required medical cover for
                  a real event are set by the local authority and the venue.
                </p>
              </motion.div>

              {/* The ratios behind the figures, adjustable */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
              >
                <h3 className="text-base font-semibold text-white mb-1">Planning assumptions</h3>
                <p className="text-xs text-ai-gray-500 mb-4">
                  Change these to match the ratios your venue or licence works to. Every figure
                  above recalculates.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'attendeesPerSteward' as const, label: 'Attendees per steward' },
                    { key: 'attendeesPerFirstAidPost' as const, label: 'Attendees per first aid post' },
                    { key: 'peoplePerExit' as const, label: 'People per exit' },
                    { key: 'camerasPerZone' as const, label: 'Cameras per zone' },
                  ].map((item) => (
                    <label key={item.key} className="block">
                      <span className="text-xs text-ai-gray-400 block mb-1">{item.label}</span>
                      <input
                        type="number"
                        min={1}
                        value={assumptions[item.key]}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isFinite(next) && next > 0) {
                            setAssumptions({ ...assumptions, [item.key]: Math.round(next) });
                          }
                        }}
                        className="w-full px-3 py-2 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white text-sm focus:border-ai-white focus:outline-none transition-colors"
                      />
                    </label>
                  ))}
                </div>
              </motion.div>

              {/* Zone breakdown */}
              {zones.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-ai-white" />
                    <h3 className="text-base font-semibold text-white">Zones</h3>
                  </div>
                  <ul className="space-y-2">
                    {zones.map((zone) => (
                      <li
                        key={zone.name}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-ai-gray-800/40"
                      >
                        <span className="text-sm text-ai-gray-200 truncate">{zone.name}</span>
                        <span className="text-sm text-ai-gray-400 shrink-0">
                          {zone.maxCapacity.toLocaleString()} capacity ·{' '}
                          {Math.max(1, Math.ceil(zone.maxCapacity / assumptions.peoplePerExit))}{' '}
                          exit(s)
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* The venue map, described as what it is */}
              {typeof event.mapFile === 'string' && event.mapFile && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
                >
                  <h3 className="text-base font-semibold text-white mb-1">Uploaded venue map</h3>
                  <p className="text-xs text-ai-gray-500 mb-4">
                    The file attached to this event. Nothing here reads it — zone geometry for
                    counting is drawn on a camera, not on this image.
                  </p>
                  <img
                    src={event.mapFile as string}
                    alt="The venue map uploaded for this event"
                    className="max-h-96 rounded-xl border border-ai-gray-800 mx-auto"
                  />
                </motion.div>
              )}

              {/* Model commentary, kept away from the numbers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-light rounded-2xl p-4 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-ai-white" />
                    <h3 className="text-base font-semibold text-white">Written commentary</h3>
                  </div>
                  <button
                    onClick={requestNotes}
                    disabled={notesLoading}
                    className="px-4 py-2 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:text-white hover:border-ai-gray-500 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                  >
                    {notesLoading && <Loader className="w-4 h-4 animate-spin" />}
                    {notes ? 'Regenerate' : 'Generate'}
                  </button>
                </div>

                <p className="text-xs text-ai-gray-500 mb-4">
                  Prose about this event's layout, written by a language model that has not seen the
                  venue. Read it as commentary on the figures above — not as measurements. Any
                  number it states that is not on this page came from nowhere.
                </p>

                {notes ? (
                  <p className="text-sm text-ai-gray-300 whitespace-pre-wrap break-anywhere">
                    {notes}
                  </p>
                ) : (
                  <p className="text-sm text-ai-gray-600">Nothing generated yet.</p>
                )}
              </motion.div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/event-setup')}
                  className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:text-white transition-colors text-sm"
                >
                  Edit event zones
                </button>
                <button
                  onClick={() => navigate('/event-cameras')}
                  className="px-4 py-2.5 rounded-xl border border-ai-gray-700 text-ai-gray-200 hover:text-white transition-colors text-sm"
                >
                  Assign cameras
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreSafetyPlanning;
