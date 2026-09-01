import type { CameraStatus } from '../../services/surveillance.service';

// One definition of how a camera's state is presented, shared by the registry
// table and the map so the two can never disagree about what a colour means.
//
// UNKNOWN is deliberately neutral rather than red. A camera nobody has probed
// yet is not a camera that is down, and colouring it as a fault would be a
// claim the system cannot support.
export const STATUS_PRESENTATION: Record<
  CameraStatus,
  { label: string; dot: string; pill: string; hex: string }
> = {
  ONLINE: {
    label: 'Online',
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    hex: '#34d399',
  },
  DEGRADED: {
    label: 'Degraded',
    dot: 'bg-amber-400',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    hex: '#fbbf24',
  },
  OFFLINE: {
    label: 'Offline',
    dot: 'bg-red-400',
    pill: 'bg-red-500/15 text-red-300 border-red-500/30',
    hex: '#f87171',
  },
  UNKNOWN: {
    label: 'Not yet probed',
    dot: 'bg-ai-gray-500',
    pill: 'bg-ai-gray-800 text-ai-gray-300 border-ai-gray-700',
    hex: '#8C8C8C',
  },
};

export const STATUS_ORDER: CameraStatus[] = ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN'];

/** Renders a timestamp, or says plainly that the event has never happened. */
export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never reached';
  return new Date(lastSeenAt).toLocaleString();
}

/** Six decimal places is roughly 0.1 m - more than a survey pin needs. */
export function formatCoordinates(latitude: number | null, longitude: number | null): string | null {
  if (latitude === null || longitude === null) return null;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Turns a bearing into a readable heading, e.g. 205 -> "205 deg (SW)". */
export function formatBearing(bearing: number | null): string | null {
  if (bearing === null) return null;
  const point = COMPASS[Math.round(bearing / 45) % 8];
  return `${Math.round(bearing)}° (${point})`;
}
