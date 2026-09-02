/**
 * Pre-event safety provision, computed from the event's own declared numbers.
 *
 * WHY THIS IS NOT A PROMPT
 * ------------------------
 * This page used to send the event name, type, attendance and a list of zone
 * names to a language model and print whatever numbers came back: "Emergency
 * Exits: 5, critical", "Security Cameras: 20", "Crowd Control Barriers: 35",
 * each with a list of positions. Ask twice and you get different numbers. None
 * of them was derived from anything - the model had no venue geometry, no exit
 * widths, no capacity model - so an organizer was reading confident engineering
 * figures that were a plausible-sounding guess, for a document they might act on.
 *
 * Everything here is arithmetic over numbers the organizer entered, and every
 * result carries the calculation that produced it. A reader can check it, and
 * can see immediately when a figure rests on an assumption rather than on data.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a compliance calculation. The ratios below are planning defaults, stated
 * as such and adjustable, not regulatory requirements - licensing conditions,
 * occupancy limits and medical cover for a real event are set by the local
 * authority and the venue, and this cannot know either. The page says so.
 */

export interface PlanningAssumptions {
  /** Stewards on duty per attendee. */
  attendeesPerSteward: number;
  /** Attendees covered by one first aid post. */
  attendeesPerFirstAidPost: number;
  /** People a single exit lane can clear in the target evacuation window. */
  peoplePerExit: number;
  /** Cameras needed to see one zone properly. */
  camerasPerZone: number;
}

export const DEFAULT_ASSUMPTIONS: PlanningAssumptions = {
  attendeesPerSteward: 100,
  attendeesPerFirstAidPost: 5000,
  peoplePerExit: 500,
  camerasPerZone: 2,
};

export interface PlanFigure {
  key: string;
  label: string;
  /** The computed number, or null when the input it needs is missing. */
  value: number | null;
  unit: string;
  /** The arithmetic, with the actual numbers substituted in. */
  basis: string;
  /** The assumption this rests on, or null when it is pure measurement. */
  assumption: string | null;
}

export interface PlanFinding {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
}

export interface PlanInput {
  attendance: number;
  zones: Array<{ name: string; maxCapacity: number }>;
  camerasAssigned: number;
  /** Zones that a camera actually covers, if that is known. */
  dispatchUnits: number;
}

export interface SafetyPlan {
  figures: PlanFigure[];
  findings: PlanFinding[];
  declaredZoneCapacity: number;
}

const ceil = (value: number) => Math.max(1, Math.ceil(value));

export function buildSafetyPlan(
  input: PlanInput,
  assumptions: PlanningAssumptions = DEFAULT_ASSUMPTIONS
): SafetyPlan {
  const { attendance, zones, camerasAssigned, dispatchUnits } = input;
  const declaredZoneCapacity = zones.reduce((sum, zone) => sum + (zone.maxCapacity || 0), 0);

  const figures: PlanFigure[] = [
    {
      key: 'stewards',
      label: 'Stewards on duty',
      value: attendance > 0 ? ceil(attendance / assumptions.attendeesPerSteward) : null,
      unit: 'stewards',
      basis:
        attendance > 0
          ? `${attendance.toLocaleString()} expected ÷ ${assumptions.attendeesPerSteward} per steward, rounded up`
          : 'No expected attendance recorded for this event',
      assumption: `one steward per ${assumptions.attendeesPerSteward} attendees`,
    },
    {
      key: 'firstAid',
      label: 'First aid posts',
      value: attendance > 0 ? ceil(attendance / assumptions.attendeesPerFirstAidPost) : null,
      unit: 'posts',
      basis:
        attendance > 0
          ? `${attendance.toLocaleString()} expected ÷ ${assumptions.attendeesPerFirstAidPost} per post, rounded up`
          : 'No expected attendance recorded for this event',
      assumption: `one post per ${assumptions.attendeesPerFirstAidPost} attendees`,
    },
    {
      key: 'exits',
      label: 'Exits across all zones',
      value:
        declaredZoneCapacity > 0
          ? zones.reduce((sum, zone) => sum + ceil(zone.maxCapacity / assumptions.peoplePerExit), 0)
          : null,
      unit: 'exits',
      basis:
        declaredZoneCapacity > 0
          ? zones
              .map(
                (zone) =>
                  `${zone.name}: ${zone.maxCapacity.toLocaleString()} ÷ ${assumptions.peoplePerExit} = ${ceil(zone.maxCapacity / assumptions.peoplePerExit)}`
              )
              .join(' · ')
          : 'No zone capacities recorded, so there is nothing to size exits against',
      assumption: `one exit per ${assumptions.peoplePerExit} people in a zone`,
    },
    {
      key: 'cameras',
      label: 'Cameras for full zone cover',
      value: zones.length > 0 ? zones.length * assumptions.camerasPerZone : null,
      unit: 'cameras',
      basis:
        zones.length > 0
          ? `${zones.length} zone${zones.length === 1 ? '' : 's'} × ${assumptions.camerasPerZone} per zone — ${camerasAssigned} currently assigned`
          : 'No zones defined, so there is nothing to cover',
      assumption: `${assumptions.camerasPerZone} cameras per zone`,
    },
  ];

  const findings: PlanFinding[] = [];

  // The most useful check available, and it needs no assumption at all: the
  // organizer's own two numbers disagreeing with each other.
  if (attendance > 0 && declaredZoneCapacity > 0 && declaredZoneCapacity < attendance) {
    findings.push({
      severity: 'critical',
      title: 'Zone capacity is below expected attendance',
      detail: `Zones account for ${declaredZoneCapacity.toLocaleString()} people and ${attendance.toLocaleString()} are expected. ${(attendance - declaredZoneCapacity).toLocaleString()} attendees have no zone with room for them, so every density figure this event reports will be measured against a plan that does not cover everyone present.`,
    });
  }

  if (zones.length === 0) {
    findings.push({
      severity: 'critical',
      title: 'No zones defined',
      detail:
        'Nothing can be sized, counted or monitored per area until the venue is divided into zones with capacities.',
    });
  }

  if (camerasAssigned === 0 && zones.length > 0) {
    findings.push({
      severity: 'warning',
      title: 'No cameras assigned to this event',
      detail:
        'Crowd density is counted through cameras borrowed from the registry. Without one, no zone will report an occupancy figure during the event.',
    });
  } else if (zones.length > 0 && camerasAssigned < zones.length) {
    findings.push({
      severity: 'warning',
      title: 'Fewer cameras than zones',
      detail: `${camerasAssigned} camera${camerasAssigned === 1 ? '' : 's'} for ${zones.length} zones. Zones with no camera will report no occupancy at all, which reads on a console as an empty area rather than an unwatched one.`,
    });
  }

  if (dispatchUnits === 0) {
    findings.push({
      severity: 'warning',
      title: 'No response units configured',
      detail:
        'The dispatch console will have nothing to send when an incident is reported. Add units in event setup before the event opens.',
    });
  }

  if (attendance <= 0) {
    findings.push({
      severity: 'info',
      title: 'No expected attendance recorded',
      detail: 'Staffing and medical provision are sized from it, so those figures cannot be produced.',
    });
  }

  return { figures, findings, declaredZoneCapacity };
}
