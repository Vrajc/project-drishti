// ============================================================================
// Great-circle distance.
//
// This is a real measurement of a real quantity: the straight-line distance
// between two stored coordinates. It is NOT a road distance and NOT a travel
// time, and callers must not present it as either. The dispatch console labels
// it "straight line" for exactly that reason - the previous version of that
// page invented a road ETA at random, and the fix is to show the
// honest lesser number rather than a plausible greater one.
//
// A real ETA needs a routing service (OSRM); until one answers, DispatchAssignment
// .etaSeconds stays null and the UI says "ETA unavailable".
// ============================================================================

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Distance in metres between two WGS84 points. */
export function haversineMetres(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Narrows a row that may carry a half-coordinate. Returns null unless both
 * halves are present, so nothing downstream can compute a distance from a
 * latitude paired with an implicit zero longitude.
 */
export function toCoordinates(row: {
  latitude?: number | null;
  longitude?: number | null;
}): Coordinates | null {
  if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') {
    return null;
  }
  return { latitude: row.latitude, longitude: row.longitude };
}
