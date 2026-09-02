import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Radio, MapPin, Clock, AlertTriangle, Loader, Send, ShieldCheck, Calendar,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { incidentService } from '../services/incident.service';
import { getEventTiming, PHASE_LABEL } from '../utils/eventStatus';

/**
 * What an attendee sees during an event they are registered for.
 *
 * The participant dashboard's "Live Updates" tile pointed at /live-monitoring -
 * the organizer's operations console. An attendee following it landed on a
 * screen built for the person running the event: every incident filed by
 * everyone, the controls to change their status, crowd density panels. It was
 * the wrong screen for the audience and it exposed the incident queue of an
 * event to the people attending it.
 *
 * This is the attendee's own view. Their event, whether it is actually running,
 * how many incidents are open on it, and a way to report one. Nothing here is
 * an aggregate of other people's reports beyond the count - and the count is
 * there because "is anything happening near me" is the question an attendee
 * actually has.
 */
const LiveUpdates: React.FC = () => {
  const { user } = useAuth();
  const { getUserRegisteredEvents } = useEvent();
  const navigate = useNavigate();
  const toast = useToast();

  const registered = useMemo(
    () => getUserRegisteredEvents(user?.id || ''),
    [getUserRegisteredEvents, user?.id]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => registered.find((e) => e.id === selectedId) ?? registered[0] ?? null,
    [registered, selectedId]
  );

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ type: 'general', description: '', location: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!selected?.id) {
      setIncidents([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await incidentService.getIncidentsByEvent(selected.id);
      setIncidents(rows);
      setLoadError(null);
    } catch (error: any) {
      // Says it could not check rather than showing an event with nothing wrong.
      setIncidents([]);
      setLoadError(error?.message ?? 'Updates could not be read');
    } finally {
      setLoading(false);
    }
  }, [selected?.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const timing = getEventTiming(selected);
  const openIncidents = incidents.filter((incident) => incident.status !== 'resolved');
  const mine = incidents.filter((incident) => incident.reporter === user?.id);

  const submit = async () => {
    if (!selected?.id) return;
    if (!form.description.trim() || !form.location.trim()) {
      toast.error('Fill in what happened and where', 'Both are needed for anyone to act on it.');
      return;
    }

    setSubmitting(true);
    try {
      await incidentService.createIncident({
        eventId: selected.id,
        type: form.type as any,
        description: form.description.trim(),
        location: form.location.trim(),
      });
      setForm({ type: 'general', description: '', location: '' });
      await load();
      toast.success('Reported', 'The event’s safety team can see it now.');
    } catch (error: any) {
      toast.error('The report was not filed', error?.message ?? 'Nothing was recorded. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-4 py-3 bg-ai-gray-800/50 border border-ai-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:border-ai-white focus:outline-none transition-colors';

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />

      <div className="relative z-10 pt-20 sm:pt-24 pb-8 sm:pb-12 safe-bottom">
        <div className="page-container max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <Radio className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 text-ai-white" />
            <h1 className="text-heading text-2xl sm:text-3xl font-bold mb-2 text-ai-white">
              Live Updates
            </h1>
            <p className="text-ai-gray-400 text-sm sm:text-base">
              Your registered events, and how to report something.
            </p>
          </motion.div>

          {registered.length === 0 ? (
            <div className="glass-light rounded-2xl p-8 sm:p-12 text-center">
              <Calendar className="w-10 h-10 text-ai-gray-600 mx-auto mb-4" />
              <p className="text-ai-white font-medium mb-1">You are not registered for any event</p>
              <p className="text-sm text-ai-gray-400 mb-5">
                Updates appear here once you register for one.
              </p>
              <button
                onClick={() => navigate('/explore-events')}
                className="px-5 py-2.5 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors text-sm font-medium"
              >
                Explore events
              </button>
            </div>
          ) : (
            <>
              {registered.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {registered.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedId(event.id)}
                      className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                        selected?.id === event.id
                          ? 'border-ai-white text-ai-white'
                          : 'border-ai-gray-700 text-ai-gray-400 hover:text-ai-white'
                      }`}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <>
                  {/* The event, as it is recorded */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-ai-white break-anywhere">
                          {selected.name}
                        </h2>
                        <p className="text-sm text-ai-gray-400 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="break-anywhere">{selected.location}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-3 py-1 rounded-full text-xs border ${
                          timing.phase === 'live'
                            ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
                            : 'border-ai-gray-700 text-ai-gray-400'
                        }`}
                      >
                        {PHASE_LABEL[timing.phase]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-ai-gray-500 text-xs mb-1">Starts</div>
                        <div className="text-ai-white">
                          {timing.startsAt ? timing.startsAt.toLocaleString() : 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className="text-ai-gray-500 text-xs mb-1">Ends</div>
                        <div className="text-ai-white">
                          {timing.endsAt ? timing.endsAt.toLocaleString() : 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className="text-ai-gray-500 text-xs mb-1">Runs for</div>
                        <div className="text-ai-white">{timing.duration ?? 'Not recorded'}</div>
                      </div>
                      <div>
                        <div className="text-ai-gray-500 text-xs mb-1">Zones</div>
                        <div className="text-ai-white">{selected.zones?.length ?? 0}</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* What is happening, or that it could not be checked */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-5 h-5 text-ai-white" />
                      <h3 className="text-base font-semibold text-white">Status</h3>
                    </div>

                    {loading ? (
                      <p className="text-sm text-ai-gray-400 flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin" /> Checking…
                      </p>
                    ) : loadError ? (
                      <p className="text-sm text-amber-400 break-anywhere">
                        Could not check for updates: {loadError}
                      </p>
                    ) : openIncidents.length === 0 ? (
                      <p className="text-sm text-ai-gray-300">
                        No open incidents reported on this event.
                      </p>
                    ) : (
                      <p className="text-sm text-ai-gray-300">
                        {openIncidents.length} open incident
                        {openIncidents.length === 1 ? '' : 's'} reported on this event. The safety
                        team is handling {openIncidents.length === 1 ? 'it' : 'them'}; follow any
                        instructions from staff on site.
                      </p>
                    )}
                  </motion.div>

                  {/* Reporting something */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-light rounded-2xl p-4 sm:p-6 mb-6"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-ai-white" />
                      <h3 className="text-base font-semibold text-white">Report something</h3>
                    </div>
                    <p className="text-xs text-ai-gray-500 mb-4">
                      Goes straight to this event's safety team. For a life-threatening emergency,
                      call the local emergency number first.
                    </p>

                    <div className="space-y-3">
                      <select
                        className={field}
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      >
                        <option value="general" className="bg-ai-black">Something else</option>
                        <option value="medical" className="bg-ai-black">Medical</option>
                        <option value="security" className="bg-ai-black">Security</option>
                        <option value="lost_found" className="bg-ai-black">Lost or found</option>
                      </select>
                      <input
                        className={field}
                        placeholder="Where are you? (e.g. near the north gate)"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                      <textarea
                        className={field}
                        rows={3}
                        placeholder="What is happening?"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                      <button
                        onClick={submit}
                        disabled={submitting}
                        className="w-full px-5 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send report
                      </button>
                    </div>
                  </motion.div>

                  {/* Their own reports, and what came of them */}
                  {mine.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-light rounded-2xl p-4 sm:p-6"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-ai-white" />
                        <h3 className="text-base font-semibold text-white">Your reports</h3>
                      </div>
                      <ul className="space-y-2">
                        {mine.map((incident) => (
                          <li key={incident._id ?? incident.id} className="p-3 rounded-lg bg-ai-gray-800/40">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-ai-gray-200 break-anywhere">
                                  {incident.description}
                                </p>
                                <p className="text-xs text-ai-gray-500 mt-1 break-anywhere">
                                  {incident.location} ·{' '}
                                  {new Date(incident.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs text-ai-gray-400 capitalize">
                                {incident.status}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveUpdates;
