import type { EstateIncident, IncidentSeverity } from '../../services/dispatch.service';

// ============================================================================
// One definition of how an incident is presented, so the console, the overview
// and anything added later cannot disagree about what a colour means. This
// mirrors cameraStatus.ts, which does the same job for camera health.
//
// The palette is deliberately monochrome-with-emphasis, matching the rest of
// the product: severity is carried by weight and border, not by a traffic-light
// scheme that would imply a precision the classification does not have.
// ============================================================================

export interface SeverityPresentation {
  label: string;
  /** Ordering weight, highest first, for sorting a queue. */
  weight: number;
  chip: string;
  border: string;
}

export const SEVERITY: Record<IncidentSeverity, SeverityPresentation> = {
  critical: {
    label: 'Critical',
    weight: 4,
    chip: 'bg-ai-white text-ai-black',
    border: 'border-ai-white',
  },
  high: {
    label: 'High',
    weight: 3,
    chip: 'bg-ai-white/20 text-ai-white border border-ai-white/40',
    border: 'border-ai-white/60',
  },
  medium: {
    label: 'Medium',
    weight: 2,
    chip: 'bg-ai-gray-800 text-ai-gray-200 border border-ai-gray-700',
    border: 'border-ai-gray-700',
  },
  low: {
    label: 'Low',
    weight: 1,
    chip: 'bg-ai-gray-900 text-ai-gray-400 border border-ai-gray-800',
    border: 'border-ai-gray-800',
  },
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
};

export const DISPATCH_STATUS_LABEL: Record<string, string> = {
  dispatched: 'Dispatched',
  acknowledged: 'Acknowledged',
  arrived: 'On scene',
  cleared: 'Cleared',
  cancelled: 'Cancelled',
};

/**
 * What each rule actually measured. Shown beside an anomaly so an operator can
 * see why it fired rather than trusting a label — the previous anomaly page
 * showed invented descriptions with an invented confidence and no provenance
 * at all.
 */
export const RULE_EXPLANATION: Record<string, string> = {
  CAMERA_OFFLINE:
    'A health probe reached this camera on the previous sweep and failed on this one.',
  ZONE_CAPACITY_BREACH:
    'A counted occupancy exceeded the capacity declared for this zone.',
  CROWD_SURGE:
    'Occupancy rose sharply between two consecutive readings for this zone.',
};

/** Human label for where an incident came from. */
export function sourceLabel(incident: EstateIncident): string {
  if (incident.source === 'anomaly') {
    return incident.ruleKey ? `Rule · ${incident.ruleKey.replace(/_/g, ' ').toLowerCase()}` : 'Rule engine';
  }
  return incident.reporterName ? `Reported by ${incident.reporterName}` : 'Reported manually';
}

/** "4 min ago". Absolute time is always shown alongside it, never replaced. */
export function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

/** Open work first, then by severity, then newest. Matches the server's order. */
export function queueOrder(a: EstateIncident, b: EstateIncident): number {
  const openness = Number(a.status === 'resolved') - Number(b.status === 'resolved');
  if (openness !== 0) return openness;

  const severity = SEVERITY[b.severity].weight - SEVERITY[a.severity].weight;
  if (severity !== 0) return severity;

  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}
