const EARTH_RADIUS_KM = 6371;

export interface Coordinates {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Straight-line distance between two coordinates in kilometres. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Straight-line distance in miles. */
export function haversineDistanceMiles(a: Coordinates, b: Coordinates): number {
  return haversineDistanceKm(a, b) * 0.621371;
}

/** Sort a list of items by distance from an origin point. */
export function sortByDistance<T extends { location: Coordinates | null }>(
  items: T[],
  origin: Coordinates,
): T[] {
  return [...items].sort((a, b) => {
    if (!a.location) return 1;
    if (!b.location) return -1;
    return haversineDistanceKm(origin, a.location) - haversineDistanceKm(origin, b.location);
  });
}
