import { describe, expect, it } from 'vitest';
import { validateAnalyticsBackup } from './analytics-backup';

const gpsActivity = {
  id: 'gps-1', date: '2025-03-01', distanceKm: 2.5, elapsedSeconds: 900, movingSeconds: 850,
  route: [{ lat: 37.77, lon: 29.08 }], source: 'gpx',
};

describe('analysis backup validation', () => {
  it('accepts supported legacy and current formats without modifying storage', () => {
    expect(validateAnalyticsBackup(JSON.stringify({ schemaVersion: 1, setEffort: { 'set-1': { rpe: 7 } } }))).toMatchObject({
      schemaVersion: 1, setEffort: { 'set-1': { rpe: 7 } }, includesGps: false, totalSetEntries: 1,
    });
    expect(validateAnalyticsBackup(JSON.stringify({ app: 'hbk-spor-analytics', schemaVersion: 3, setEffort: {}, gpsImports: [gpsActivity] }))).toMatchObject({
      schemaVersion: 3, gpsActivities: [gpsActivity], invalidGpsEntries: 0, includesGps: true,
    });
  });

  it('counts and ignores malformed set and GPS rows instead of silently accepting them', () => {
    const result = validateAnalyticsBackup(JSON.stringify({
      schemaVersion: 2,
      setEffort: { good: { rpe: 8, restSeconds: 90 }, badRpe: { rpe: 11 }, empty: {}, '': { rpe: 2 } },
      gpsImports: [gpsActivity, { ...gpsActivity, id: 'bad-lat', route: [{ lat: 100, lon: 29 }] }, { source: 'app' }],
    }));
    expect(result.setEffort).toEqual({ good: { rpe: 8, restSeconds: 90 } });
    expect(result.totalSetEntries).toBe(4);
    expect(result.invalidSetEntries).toBe(3);
    expect(result.gpsActivities).toEqual([gpsActivity]);
    expect(result.totalGpsEntries).toBe(3);
    expect(result.invalidGpsEntries).toBe(2);
  });

  it('rejects prototype-mutating set keys from untrusted JSON', () => {
    const result = validateAnalyticsBackup('{"schemaVersion":3,"setEffort":{"__proto__":{"rpe":8},"safe":{"rpe":5}}}');
    expect(result.setEffort).toEqual({ safe: { rpe: 5 } });
    expect(result.invalidSetEntries).toBe(1);
    expect(Object.getPrototypeOf(result.setEffort)).toBe(Object.prototype);
  });

  it('does not mark a malformed GPS field as safe to merge', () => {
    const result = validateAnalyticsBackup(JSON.stringify({ schemaVersion: 3, setEffort: { ok: { rpe: 5 } }, gpsImports: { unexpected: true } }));
    expect(result.includesGps).toBe(true);
    expect(result.gpsMergeable).toBe(false);
    expect(result.invalidGpsEntries).toBe(1);
  });

  it('rejects non-JSON, unsupported schemas, foreign app backups and malformed roots', () => {
    expect(() => validateAnalyticsBackup('{')).toThrow('geçerli JSON');
    expect(() => validateAnalyticsBackup(JSON.stringify({ schemaVersion: 99, setEffort: {} }))).toThrow('desteklenmiyor');
    expect(() => validateAnalyticsBackup(JSON.stringify({ app: 'other-app', schemaVersion: 3, setEffort: {} }))).toThrow('başka bir uygulamaya');
    expect(() => validateAnalyticsBackup(JSON.stringify({ schemaVersion: 2, setEffort: [] }))).toThrow('desteklenmiyor');
  });
});
