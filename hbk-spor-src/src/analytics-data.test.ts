// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FitBaseType, FitEncoder } from 'fit-file-parser/encoder';
import { GPS_IMPORTS_KEY, parseFitActivity, parseGpxActivity, parseTcxActivity, readSupplementalAnalytics, saveImportedGpsActivities } from './analytics-data';
import type { LegacyWorkout } from './types';

const sampleGpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><trkseg>
  <trkpt lat="37.7760" lon="29.0860"><ele>100</ele><time>2026-10-29T06:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>120</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="37.7770" lon="29.0860"><ele>103</ele><time>2026-10-29T06:01:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="37.7780" lon="29.0860"><ele>101</ele><time>2026-10-29T06:02:00Z</time></trkpt>
</trkseg></trk></gpx>`;

afterEach(() => window.localStorage.clear());

describe('Strava-style GPX import', () => {
  it('calculates distance, elapsed/moving time, elevation and available heart rate while retaining a compact route', () => {
    const activity = parseGpxActivity(sampleGpx, 'morning-run.gpx', '2026-10-29T07:00:00.000Z');
    expect(activity).toMatchObject({
      date: '2026-10-29',
      elapsedSeconds: 120,
      movingSeconds: 120,
      elevationGainM: 3,
      avgHeartRate: 135,
      maxHeartRate: 150,
      source: 'gpx',
      fileName: 'morning-run.gpx',
    });
    expect(activity.distanceKm).toBeGreaterThan(0.2);
    expect(activity.route).toHaveLength(3);
  });

  it('rejects malformed files and tracks too short to be meaningful', () => {
    expect(() => parseGpxActivity('<gpx><trkpt></gpx>', 'broken.gpx')).toThrow(/GPX/);
    const short = '<gpx><trk><trkseg><trkpt lat="37.7" lon="29.0"><time>2026-10-29T06:00:00Z</time></trkpt><trkpt lat="37.70001" lon="29.0"><time>2026-10-29T06:00:20Z</time></trkpt></trkseg></trk></gpx>';
    expect(() => parseGpxActivity(short, 'short.gpx')).toThrow(/çok kısa/);
  });


  it('reads TCX device tracks and reports sensor fields without inventing missing samples', () => {
    const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="2026-10-29T06:00:00Z"><Track>
      <Trackpoint><Time>2026-10-29T06:00:00Z</Time><Position><LatitudeDegrees>37.7760</LatitudeDegrees><LongitudeDegrees>29.0860</LongitudeDegrees></Position><AltitudeMeters>100</AltitudeMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-10-29T06:01:00Z</Time><Position><LatitudeDegrees>37.7770</LatitudeDegrees><LongitudeDegrees>29.0860</LongitudeDegrees></Position><AltitudeMeters>103</AltitudeMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const activity = parseTcxActivity(tcx, 'watch-export.tcx', '2026-10-29T07:00:00.000Z');
    expect(activity.source).toBe('tcx');
    expect(activity.distanceKm).toBeGreaterThan(0.1);
    expect(activity.avgHeartRate).toBe(135);
    expect(activity.elevationGainM).toBe(3);
  });

  it('parses a valid device FIT route in the browser-compatible binary path', async () => {
    const encoder = new FitEncoder();
    const semicircles = (degrees: number) => Math.round(degrees * 2 ** 31 / 180);
    for (const [minute, latitude, heartRate] of [[0, 37.776, 120], [1, 37.778, 150]] as const) {
      const timestamp = new Date(`2026-10-29T06:0${minute}:00Z`);
      encoder.writeMessage(20, [
        { number: 253, size: 4, baseType: FitBaseType.Uint32, value: FitEncoder.toFitTimestamp(timestamp) },
        { number: 0, size: 4, baseType: FitBaseType.Sint32, value: semicircles(latitude) },
        { number: 1, size: 4, baseType: FitBaseType.Sint32, value: semicircles(29.086) },
        { number: 2, size: 2, baseType: FitBaseType.Uint16, value: 3000 },
        { number: 3, size: 1, baseType: FitBaseType.Uint8, value: heartRate },
        { number: 4, size: 1, baseType: FitBaseType.Uint8, value: 90 },
      ]);
    }
    const bytes = encoder.close();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const activity = await parseFitActivity(buffer, 'watch.fit');
    expect(activity.source).toBe('fit');
    expect(activity.route).toHaveLength(2);
    expect(activity.distanceKm).toBeGreaterThan(0.1);
    expect(activity.avgHeartRate).toBe(135);
  });

  it('builds approximate one-kilometre splits and safely rejects invalid FIT binaries', async () => {
    const longGpx = `<gpx><trk><trkseg><trkpt lat="37.7" lon="29.000"><time>2026-10-29T06:00:00Z</time></trkpt><trkpt lat="37.7" lon="29.010"><time>2026-10-29T06:02:00Z</time></trkpt><trkpt lat="37.7" lon="29.020"><time>2026-10-29T06:04:00Z</time></trkpt></trkseg></trk></gpx>`;
    const activity = parseGpxActivity(longGpx, 'splits.gpx');
    expect(activity.splits).toHaveLength(2);
    expect(activity.splits?.[0].distanceKm).toBe(1);
    await expect(parseFitActivity(new ArrayBuffer(16), 'broken.fit')).rejects.toThrow(/FIT/);
  });

  it('persists imported activities locally and combines them with app GPS, tests and recovery check-ins', () => {
    const imported = parseGpxActivity(sampleGpx, 'run.gpx');
    expect(saveImportedGpsActivities([imported])).toBe(true);
    expect(window.localStorage.getItem(GPS_IMPORTS_KEY)).toContain('run.gpx');
    window.localStorage.setItem('hbk_gps_runs', JSON.stringify([{ id: 'app-run', date: '2026-10-28', distanceKm: 1, durationSec: 500, movingSec: 480, points: [{ lat: 37.7, lng: 29 }] }, { id: 'demo-run', date: '2026-10-28', distanceKm: 99, durationSec: 500, movingSec: 480, points: [] }]));
    window.localStorage.setItem('hbk_skill_tests_v1', JSON.stringify([{ id: 'test-1', name: '20m sprint', unit: 'sn', category: 'Hız', history: [{ date: '2026-10-20', value: 3.2 }] }]));
    const workout = { id: 'recovery-1', date: '2026-10-29', type: 'toparlanma', wellness: { sleep: 4, energy: 3, soreness: 2, stress: 2 } } as LegacyWorkout;
    const result = readSupplementalAnalytics([workout]);
    expect(result.gpsActivities).toHaveLength(2);
    expect(result.skillTests[0].name).toBe('20m sprint');
    expect(result.wellness[0]).toMatchObject({ sleep: 4, energy: 3, soreness: 2, stress: 2 });
  });
});
