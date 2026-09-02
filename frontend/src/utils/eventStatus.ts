/**
 * Whether an event is running, and for how long it runs.
 *
 * Four screens each carried their own copy of this:
 *
 *   const eventEndTime = new Date(eventDate.getTime() + (8 * 60 * 60 * 1000));
 *
 * Eight hours, assumed, because nothing recorded when an event ended. A
 * two-hour talk was reported live for eight; a three-day festival went dark
 * after the first evening; a participant's "live updates" tile lit up and
 * switched off on a timer unrelated to the event. The post-event report printed
 * "8 hours" as the duration of every event ever held.
 *
 * Events now record an end. Where one is missing - every event created before
 * that column existed - the answer is `unknown`, and callers say so instead of
 * substituting a length nobody entered.
 */

export type EventPhase = 'upcoming' | 'live' | 'ended' | 'unknown';

export interface EventTiming {
  phase: EventPhase;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Human-readable run time, or null when no end is recorded. */
  duration: string | null;
}

/** Combines a `YYYY-MM-DD` date and an `HH:MM` time into a local Date. */
function combine(date?: string | null, time?: string | null): Date | null {
  if (!date) return null;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      parsed.setHours(hours, minutes, 0, 0);
      return parsed;
    }
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function describeSpan(from: Date, to: Date): string | null {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return null;

  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min`);
  return parts.join(' ') || null;
}

export interface TimedEvent {
  date: string;
  time: string;
  endDate?: string | null;
  endTime?: string | null;
}

export function getEventTiming(event: TimedEvent | null | undefined, now = new Date()): EventTiming {
  if (!event) return { phase: 'unknown', startsAt: null, endsAt: null, duration: null };

  const startsAt = combine(event.date, event.time);
  // An end time with no end date means the same day, which is the common case
  // and the only assumption here - it is stated, not silent.
  const endsAt = combine(event.endDate || event.date, event.endTime);

  if (!startsAt) return { phase: 'unknown', startsAt: null, endsAt, duration: null };

  const duration = endsAt ? describeSpan(startsAt, endsAt) : null;

  if (!endsAt) {
    // Before it starts is still knowable without an end.
    return {
      phase: now < startsAt ? 'upcoming' : 'unknown',
      startsAt,
      endsAt: null,
      duration: null,
    };
  }

  if (now < startsAt) return { phase: 'upcoming', startsAt, endsAt, duration };
  if (now > endsAt) return { phase: 'ended', startsAt, endsAt, duration };
  return { phase: 'live', startsAt, endsAt, duration };
}

/** Wording for a phase, including the one that means "nobody recorded an end". */
export const PHASE_LABEL: Record<EventPhase, string> = {
  upcoming: 'Upcoming',
  live: 'Live now',
  ended: 'Ended',
  unknown: 'End time not recorded',
};
