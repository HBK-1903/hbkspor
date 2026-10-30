import type { GpsRoutePoint } from './types';

export type MapCoordinate = [latitude: number, longitude: number];
export type PlanarCoordinate = [x: number, y: number];
export type ProjectedGpsRoute = {
  points: PlanarCoordinate[];
  start: PlanarCoordinate;
  finish: PlanarCoordinate;
};

/** Reject malformed or out-of-range saved/imported coordinates before map rendering. */
export function validGpsRoute(points: readonly GpsRoutePoint[]): GpsRoutePoint[] {
  return points.filter((point) => Number.isFinite(point.lat)
    && Number.isFinite(point.lon)
    && point.lat >= -90 && point.lat <= 90
    && point.lon >= -180 && point.lon <= 180);
}

export type RouteSegmentPosition = { index: number; progress: number; basis: 'time' | 'distance' | 'samples' };

/** Locate a fraction of recorded time when timestamps exist, otherwise distance, then sample order. */
export function gpsRouteSegmentAtProgress(points: readonly GpsRoutePoint[], progress: number): RouteSegmentPosition | null {
  const route = validGpsRoute(points);
  if (route.length < 2) return null;
  const fraction = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const timestamps = route.map((point) => point.time ? Date.parse(point.time) : NaN);
  const hasTime = timestamps.every(Number.isFinite)
    && timestamps[timestamps.length - 1]! > timestamps[0]!
    && timestamps.every((time, index) => index === 0 || time >= timestamps[index - 1]!);
  const distances = route.map((point) => point.distanceKm);
  const hasDistance = !hasTime && distances.every((distance): distance is number => typeof distance === 'number' && Number.isFinite(distance))
    && distances[distances.length - 1]! > distances[0]!
    && distances.every((distance, index) => index === 0 || distance! >= distances[index - 1]!);
  const values = hasTime ? timestamps : hasDistance ? distances as number[] : route.map((_, index) => index);
  const basis: RouteSegmentPosition['basis'] = hasTime ? 'time' : hasDistance ? 'distance' : 'samples';
  const target = values[0]! + (values[values.length - 1]! - values[0]!) * fraction;
  let index = 0;
  while (index < route.length - 2 && values[index + 1]! <= target) index += 1;
  const span = values[index + 1]! - values[index]!;
  return { index, progress: span > 0 ? Math.max(0, Math.min(1, (target - values[index]!) / span)) : 0, basis };
}

export function gpsCoordinateAtProgress(points: readonly GpsRoutePoint[], progress: number): MapCoordinate | null {
  const route = validGpsRoute(points);
  if (!route.length) return null;
  const segment = gpsRouteSegmentAtProgress(route, progress);
  if (!segment) return [route[0].lat, route[0].lon];
  const start = route[segment.index], finish = route[segment.index + 1];
  return [
    start.lat + (finish.lat - start.lat) * segment.progress,
    start.lon + (finish.lon - start.lon) * segment.progress,
  ];
}

export function gpsDistanceAtProgress(points: readonly GpsRoutePoint[], progress: number, fallbackDistanceKm = 0): number {
  const route = validGpsRoute(points);
  const segment = gpsRouteSegmentAtProgress(route, progress);
  if (!route.length) return 0;
  if (!segment) return route[0].distanceKm ?? 0;
  const start = route[segment.index].distanceKm;
  const finish = route[segment.index + 1].distanceKm;
  if (typeof start !== 'number' || typeof finish !== 'number') return Math.max(0, fallbackDistanceKm * progress);
  return start + (finish - start) * segment.progress;
}

/** Shared local equirectangular projection; preserves relative scale across route overlays. */
export function projectGpsRoutes(
  routeLists: readonly (readonly GpsRoutePoint[])[],
  width = 120,
  height = 100,
  padding = 10,
): ProjectedGpsRoute[] | null {
  const routes = routeLists.map(validGpsRoute).filter((route) => route.length >= 2);
  if (!routes.length || width <= padding * 2 || height <= padding * 2) return null;
  const allPoints = routes.flat();
  const midLatitude = allPoints.reduce((sum, point) => sum + point.lat, 0) / allPoints.length;
  const longitudeScale = Math.max(0.01, Math.cos(midLatitude * Math.PI / 180));
  const rawRoutes = routes.map((route) => route.map((point) => [point.lon * longitudeScale, point.lat] as const));
  const rawPoints = rawRoutes.flat();
  const xs = rawPoints.map(([x]) => x), ys = rawPoints.map(([, y]) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9), spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const project = ([x, y]: readonly [number, number]): PlanarCoordinate => [
    Math.min(width - padding, Math.max(padding, offsetX + (x - minX) * scale)),
    Math.min(height - padding, Math.max(padding, height - offsetY - (y - minY) * scale)),
  ];
  return rawRoutes.map((route) => {
    const projected = route.map(project);
    return { points: projected, start: projected[0], finish: projected[projected.length - 1] };
  });
}

export function projectGpsRoute(points: readonly GpsRoutePoint[], width = 120, height = 100, padding = 10): ProjectedGpsRoute | null {
  return projectGpsRoutes([points], width, height, padding)?.[0] ?? null;
}

export function gpsRouteCenter(points: readonly GpsRoutePoint[]): MapCoordinate | null {
  const route = validGpsRoute(points);
  if (!route.length) return null;
  return [
    route.reduce((sum, point) => sum + point.lat, 0) / route.length,
    route.reduce((sum, point) => sum + point.lon, 0) / route.length,
  ];
}
