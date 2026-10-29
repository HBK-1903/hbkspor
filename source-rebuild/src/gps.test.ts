import { afterEach, describe, expect, it, vi } from 'vitest';
import { distanceBetweenPointsKm, parseGpx } from './gps';

class FakeNode {
  constructor(public localName: string, private attrs: Record<string, string> = {}, public textContent: string | null = null, public children: FakeNode[] = []) {}
  getAttribute(name: string) { return this.attrs[name] ?? null; }
  getElementsByTagName(name: string): FakeNode[] {
    const descendants = this.children.flatMap((child) => [child, ...child.getElementsByTagName('*')]);
    return name === '*' ? descendants : descendants.filter((child) => child.localName === name);
  }
}

class FakeDocument {
  constructor(private points: FakeNode[], private malformed = false) {}
  querySelector(selector: string) { return selector === 'parsererror' && this.malformed ? {} : null; }
  getElementsByTagName(name: string) { return name === '*' ? this.points : []; }
}

function installParser(points: FakeNode[], malformed = false) {
  vi.stubGlobal('DOMParser', class { parseFromString() { return new FakeDocument(points, malformed); } });
}

afterEach(() => vi.unstubAllGlobals());

const point = (lat: number, lon: number, time: string, elevation = 12) => new FakeNode('trkpt', { lat: String(lat), lon: String(lon) }, null, [new FakeNode('ele', {}, String(elevation)), new FakeNode('time', {}, time)]);

describe('GPX route helpers', () => {
  it('computes geographic distance with a haversine calculation', () => {
    const km = distanceBetweenPointsKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(km).toBeGreaterThan(111);
    expect(km).toBeLessThan(112);
  });

  it('parses local route points, date, distance, duration and segment speed', () => {
    installParser([
      point(37.77, 29.08, '2026-10-29T08:00:00Z'),
      point(37.78, 29.08, '2026-10-29T08:01:00Z', 18),
    ]);
    const activity = parseGpx('<gpx/>', 'denizli.gpx', 'route-1', new Date(2026, 9, 29, 12));
    expect(activity.id).toBe('route-1');
    expect(activity.fileName).toBe('denizli.gpx');
    expect(activity.date).toMatch(/^2026-10-29$/);
    expect(activity.distanceKm).toBeGreaterThan(1);
    expect(activity.durationSeconds).toBe(60);
    expect(activity.route[1].elevationM).toBe(18);
    expect(activity.route[1].speedKmh).toBeGreaterThan(0);
  });

  it('rejects malformed routes and files with too few route points', () => {
    installParser([], true);
    expect(() => parseGpx('<gpx><')).toThrow('GPX dosyası okunamadı');
    installParser([point(37, 29, '2026-10-29T08:00:00Z')]);
    expect(() => parseGpx('<gpx/>')).toThrow('en az iki rota noktası');
  });

  it('simplifies large imported tracks while keeping start and finish samples', () => {
    const points = Array.from({ length: 1_000 }, (_, index) => point(37 + index * 0.00001, 29, new Date(Date.UTC(2026, 9, 29, 8, index)).toISOString()));
    installParser(points);
    const activity = parseGpx('<gpx/>', 'long.gpx');
    expect(activity.route.length).toBeLessThanOrEqual(300);
    expect(activity.route[0].lat).toBe(Number(points[0].getAttribute('lat')));
    expect(activity.route[activity.route.length - 1]?.lat).toBeCloseTo(37.00999, 5);
  });
});
