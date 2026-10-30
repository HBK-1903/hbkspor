// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { gpsCoordinateAtProgress, gpsDistanceAtProgress, gpsRouteCenter, gpsRouteSegmentAtProgress, projectGpsRoute, projectGpsRoutes, validGpsRoute } from './gps-map';
import type { GpsRoutePoint } from './types';

const route: GpsRoutePoint[] = [
  { lat: 37.776, lon: 29.086, distanceKm: 0 },
  { lat: 37.777, lon: 29.0865, distanceKm: 0.12 },
  { lat: 37.778, lon: 29.087, distanceKm: 0.25 },
];

describe('GPS map geometry', () => {
  it('filters malformed or out-of-range GPS coordinates', () => {
    const mixed = [...route, { lat: Number.NaN, lon: 29, distanceKm: 1 }, { lat: 91, lon: 29, distanceKm: 1 }];
    expect(validGpsRoute(mixed)).toHaveLength(3);
    expect(gpsRouteCenter([{ lat: 91, lon: 500 }])).toBeNull();
    expect(projectGpsRoute(mixed)).not.toBeNull();
  });

  it('keeps a route inside the thumbnail and preserves geographic aspect ratio', () => {
    const projected = projectGpsRoute(route, 120, 100, 10);
    expect(projected).not.toBeNull();
    const coords = projected!.points;
    expect(coords.every(([x, y]) => x >= 10 && x <= 110 && y >= 10 && y <= 90)).toBe(true);
    const routeWidth = Math.max(...coords.map(([x]) => x)) - Math.min(...coords.map(([x]) => x));
    const routeHeight = Math.max(...coords.map(([, y]) => y)) - Math.min(...coords.map(([, y]) => y));
    expect(routeWidth).toBeLessThan(routeHeight);
    expect(projected?.start).toEqual(coords[0]);
    expect(projected?.finish).toEqual(coords[coords.length - 1]);
  });

  it('projects a stationary valid route without emitting non-finite coordinates', () => {
    const stationary: GpsRoutePoint[] = [{ lat: 37.77, lon: 29.08 }, { lat: 37.77, lon: 29.08 }];
    const projected = projectGpsRoute(stationary);
    expect(projected).not.toBeNull();
    expect(projected!.points.flat().every(Number.isFinite)).toBe(true);
  });

  it('returns a timeline position using recorded timestamps and interpolates distance', () => {
    const timed: GpsRoutePoint[] = [
      { lat: 0, lon: 0, distanceKm: 0, time: '2025-01-01T00:00:00Z' },
      { lat: 1, lon: 1, distanceKm: 1, time: '2025-01-01T00:00:10Z' },
      { lat: 2, lon: 2, distanceKm: 4, time: '2025-01-01T00:00:30Z' },
    ];
    expect(gpsRouteSegmentAtProgress(timed, 0.5)).toEqual({ index: 1, progress: 0.25, basis: 'time' });
    expect(gpsCoordinateAtProgress(timed, 0.5)).toEqual([1.25, 1.25]);
    expect(gpsDistanceAtProgress(timed, 0.5)).toBe(1.75);
  });

  it('falls back to distance or sample order for routes without reliable timestamps', () => {
    expect(gpsRouteSegmentAtProgress(route, 0.5)?.basis).toBe('distance');
    const noDistance = route.map(({ lat, lon }) => ({ lat, lon }));
    expect(gpsRouteSegmentAtProgress(noDistance, 0.5)?.basis).toBe('samples');
    expect(gpsCoordinateAtProgress(noDistance, 1)).toEqual([route[2].lat, route[2].lon]);
  });

  it('projects two activities on a shared scale for local route overlays', () => {
    const other = route.map((point) => ({ ...point, lon: point.lon + 0.01 }));
    const projected = projectGpsRoutes([route, other]);
    expect(projected).toHaveLength(2);
    expect(projected![0].start[0]).not.toBe(projected![1].start[0]);
    expect(projected!.flatMap((item) => item.points.flat()).every(Number.isFinite)).toBe(true);
  });
});
