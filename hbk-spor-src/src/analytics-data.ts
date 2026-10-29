import type { GpsActivity, GpsQuality, GpsRoutePoint, GpsSplit, LegacyWorkout, SkillTestRecord, WellnessPoint } from './types';

export const GPS_RUNS_KEY = 'hbk_gps_runs';
export const SKILL_TESTS_KEY = 'hbk_skill_tests_v1';
export const GPS_IMPORTS_KEY = 'hbk_analytics_gps_imports_v1';
export const MAX_GPX_BYTES = 20 * 1024 * 1024;
const MAX_SAVED_ROUTE_POINTS = 600;

function readArray<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export interface AnalyticsSupplementalData {
  gpsActivities: GpsActivity[];
  skillTests: SkillTestRecord[];
  wellness: WellnessPoint[];
}

function readAppGpsQuality(value: unknown): GpsQuality | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const quality = value as Record<string, unknown>;
  if (!['good', 'fair', 'poor'].includes(String(quality.grade))) return undefined;
  const numeric = (key: string) => typeof quality[key] === 'number' && Number.isFinite(quality[key]) && Number(quality[key]) >= 0 ? Number(quality[key]) : undefined;
  const median = quality.medianAccuracyM;
  return {
    grade: quality.grade as GpsQuality['grade'],
    ...(typeof median === 'number' && Number.isFinite(median) && median >= 0 ? { medianAccuracyM: median } : median === null ? { medianAccuracyM: null } : {}),
    ...(numeric('acceptedSegments') !== undefined ? { acceptedSegments: numeric('acceptedSegments') } : {}),
    ...(numeric('rejectedPoints') !== undefined ? { rejectedPoints: numeric('rejectedPoints') } : {}),
    ...(numeric('stationarySamples') !== undefined ? { stationarySamples: numeric('stationarySamples') } : {}),
    ...(numeric('gapSeconds') !== undefined ? { gapSeconds: numeric('gapSeconds') } : {}),
    ...(numeric('backgroundGapSeconds') !== undefined ? { backgroundGapSeconds: numeric('backgroundGapSeconds') } : {}),
  };
}

export function readSupplementalAnalytics(workouts: LegacyWorkout[]): AnalyticsSupplementalData {
  const appGps = readArray<Record<string, unknown>>(GPS_RUNS_KEY).flatMap((run): GpsActivity[] => {
    if (typeof run.id !== 'string' || /^demo[-_]/i.test(run.id) || typeof run.date !== 'string' || typeof run.distanceKm !== 'number') return [];
    const rawPoints = Array.isArray(run.points) ? run.points.flatMap((point): GpsRoutePoint[] => {
      if (!point || typeof point !== 'object') return [];
      const p = point as Record<string, unknown>;
      const number = (raw: unknown) => typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
      const lat = number(p.lat);
      const lon = number(p.lng ?? p.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
      const rawTime = p.t ?? p.time ?? p.timestamp;
      const timestamp = typeof rawTime === 'number' ? rawTime : typeof rawTime === 'string' ? Date.parse(rawTime) : NaN;
      const elevation = number(p.elevationM ?? p.elevation ?? p.altitude);
      const heartRate = number(p.heartRate ?? p.hr);
      const cadence = number(p.cadence ?? p.cad);
      const distanceKm = number(p.distanceKm ?? p.cumulativeDistanceKm);
      const accuracy = number(p.acc ?? p.accuracyM ?? p.accuracy);
      const speedMps = number(p.speedMps ?? p.speed);
      const speedKmh = number(p.speedKmh);
      return [{
        lat, lon,
        ...(Number.isFinite(timestamp) && timestamp > 0 ? { time: new Date(timestamp).toISOString() } : {}),
        ...(Number.isFinite(distanceKm) && distanceKm >= 0 ? { distanceKm } : {}),
        ...(Number.isFinite(elevation) ? { elevationM: elevation } : {}),
        ...(Number.isFinite(heartRate) && heartRate > 0 && heartRate < 260 ? { heartRate } : {}),
        ...(Number.isFinite(cadence) && cadence > 0 && cadence < 300 ? { cadence } : {}),
        ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracyM: accuracy } : {}),
        ...(Number.isFinite(speedKmh) && speedKmh >= 0 ? { speedKmh } : Number.isFinite(speedMps) && speedMps >= 0 ? { speedKmh: speedMps * 3.6 } : {}),
      }];
    }) : [];
    let cumulativeMeters = 0;
    const points = rawPoints.map((point, index) => {
      if (index > 0 && point.distanceKm === undefined) {
        const previous = rawPoints[index - 1];
        const elapsed = previous.time && point.time ? (Date.parse(point.time) - Date.parse(previous.time)) / 1000 : 0;
        const distance = haversineMeters(previous, point);
        if (elapsed > 0 && elapsed <= 300 && distance / elapsed <= 60) cumulativeMeters += distance;
      } else if (point.distanceKm !== undefined) cumulativeMeters = point.distanceKm * 1000;
      return { ...point, distanceKm: point.distanceKm ?? Math.round(cumulativeMeters) / 1000 };
    });
    const movingSeconds = Math.max(0, Number(run.movingSec) || 0);
    const distanceKm = Number(run.distanceKm);
    const quality = readAppGpsQuality(run.quality);
    const speeds = points.flatMap((point) => point.speedKmh !== undefined ? [point.speedKmh] : []);
    return [{
      id: run.id,
      date: run.date,
      distanceKm,
      elapsedSeconds: Math.max(0, Number(run.durationSec) || 0),
      movingSeconds,
      ...(typeof run.pausedSec === 'number' && Number.isFinite(run.pausedSec) && run.pausedSec >= 0 ? { pausedSeconds: run.pausedSec } : {}),
      ...(quality ? { quality } : {}),
      ...(movingSeconds > 0 && distanceKm > 0 ? { avgSpeedKmh: distanceKm / movingSeconds * 3600 } : {}),
      ...(speeds.length ? { maxSpeedKmh: speeds.reduce((best, speed) => Math.max(best, speed), 0) } : {}),
      route: evenlySample(points, MAX_SAVED_ROUTE_POINTS),
      source: 'app',
    }];
  });

  const importedGps = readArray<GpsActivity>(GPS_IMPORTS_KEY).filter(isGpsActivity);
  const uniqueGps = new Map<string, GpsActivity>();
  for (const activity of [...appGps, ...importedGps]) uniqueGps.set(activity.id, activity);

  const skillTests = readArray<Record<string, unknown>>(SKILL_TESTS_KEY).flatMap((item): SkillTestRecord[] => {
    if (typeof item.id !== 'string' || /^demo[-_]/i.test(item.id) || typeof item.name !== 'string' || !Array.isArray(item.history)) return [];
    const history = item.history.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const row = entry as Record<string, unknown>;
      return typeof row.date === 'string' && typeof row.value === 'number' && Number.isFinite(row.value) ? [{ date: row.date, value: row.value }] : [];
    });
    return [{ id: item.id, name: item.name, unit: typeof item.unit === 'string' ? item.unit : '', ...(typeof item.category === 'string' ? { category: item.category } : {}), ...(typeof item.target === 'number' ? { target: item.target } : {}), history }];
  });
  const wellness = workouts.flatMap((workout): WellnessPoint[] => {
    const raw = workout.wellness;
    if (!raw || typeof raw !== 'object') return [];
    const values = raw as Record<string, unknown>;
    const valid = (key: string) => typeof values[key] === 'number' && Number.isFinite(values[key]) && Number(values[key]) >= 1 && Number(values[key]) <= 5;
    if (!['sleep', 'energy', 'soreness', 'stress'].every(valid)) return [];
    return [{ workoutId: workout.id, date: workout.date, title: workout.title || 'Toparlanma check-in', sleep: Number(values.sleep), energy: Number(values.energy), soreness: Number(values.soreness), stress: Number(values.stress) }];
  }).sort((a, b) => a.date.localeCompare(b.date));

  return { gpsActivities: [...uniqueGps.values()].sort((a, b) => b.date.localeCompare(a.date)), skillTests, wellness };
}

function isGpsActivity(value: unknown): value is GpsActivity {
  if (!value || typeof value !== 'object') return false;
  const activity = value as Partial<GpsActivity>;
  const optionalNumber = (number: unknown, min = 0) => number === undefined || (typeof number === 'number' && Number.isFinite(number) && number >= min);
  const quality = activity.quality;
  const validQuality = quality === undefined || Boolean(quality && ['good', 'fair', 'poor'].includes(quality.grade)
    && (quality.medianAccuracyM === undefined || quality.medianAccuracyM === null || optionalNumber(quality.medianAccuracyM))
    && optionalNumber(quality.acceptedSegments) && optionalNumber(quality.rejectedPoints)
    && optionalNumber(quality.stationarySamples) && optionalNumber(quality.gapSeconds)
    && optionalNumber(quality.backgroundGapSeconds));
  return typeof activity.id === 'string'
    && typeof activity.date === 'string'
    && typeof activity.distanceKm === 'number' && Number.isFinite(activity.distanceKm) && activity.distanceKm > 0
    && typeof activity.elapsedSeconds === 'number' && Number.isFinite(activity.elapsedSeconds) && activity.elapsedSeconds >= 0
    && typeof activity.movingSeconds === 'number' && Number.isFinite(activity.movingSeconds) && activity.movingSeconds >= 0
    && optionalNumber(activity.pausedSeconds)
    && optionalNumber(activity.avgSpeedKmh) && optionalNumber(activity.maxSpeedKmh)
    && optionalNumber(activity.elevationGainM) && optionalNumber(activity.avgHeartRate, 1)
    && optionalNumber(activity.maxHeartRate, 1) && optionalNumber(activity.avgCadence, 1)
    && optionalNumber(activity.maxCadence, 1) && validQuality
    && Array.isArray(activity.route) && activity.route.length <= MAX_SAVED_ROUTE_POINTS
    && activity.route.every((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180
      && (point.time === undefined || (typeof point.time === 'string' && Number.isFinite(Date.parse(point.time))))
      && (point.distanceKm === undefined || (Number.isFinite(point.distanceKm) && point.distanceKm >= 0))
      && (point.elevationM === undefined || Number.isFinite(point.elevationM))
      && (point.heartRate === undefined || (Number.isFinite(point.heartRate) && point.heartRate > 0 && point.heartRate < 260))
      && (point.cadence === undefined || (Number.isFinite(point.cadence) && point.cadence > 0 && point.cadence < 300))
      && (point.accuracyM === undefined || (Number.isFinite(point.accuracyM) && point.accuracyM >= 0))
      && (point.speedKmh === undefined || (Number.isFinite(point.speedKmh) && point.speedKmh >= 0)))
    && ['gpx', 'tcx', 'fit'].includes(activity.source ?? '');
}

function childText(element: Element, localName: string): string | undefined {
  const child = Array.from(element.getElementsByTagName('*')).find((item) => item.localName.toLowerCase() === localName.toLowerCase());
  return child?.textContent?.trim() || undefined;
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, value)));
}

function evenlySample<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values;
  return Array.from({ length: limit }, (_, index) => values[Math.round(index * (values.length - 1) / (limit - 1))]);
}

export function parseGpxActivity(xml: string, fileName: string, importedAt = new Date().toISOString()): GpsActivity {
  if (typeof DOMParser === 'undefined') throw new Error('Bu tarayıcı GPX/XML dosyalarını okuyamıyor.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('GPX dosyası okunamadı; dosyanın geçerli GPX XML olduğundan emin ol.');
  const rawSegments = Array.from(document.getElementsByTagName('*'))
    .filter((element) => element.localName.toLowerCase() === 'trkseg')
    .map((segment) => Array.from(segment.getElementsByTagName('*')).filter((element) => element.localName.toLowerCase() === 'trkpt'));
  const segments = rawSegments.length ? rawSegments : [Array.from(document.getElementsByTagName('*')).filter((element) => ['trkpt', 'rtept'].includes(element.localName.toLowerCase()))];
  const parsedSegments = segments.map((segment) => segment.flatMap((element) => {
    const lat = Number(element.getAttribute('lat'));
    const lon = Number(element.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    const rawTime = childText(element, 'time');
    const time = rawTime ? Date.parse(rawTime) : undefined;
    const rawElevation = childText(element, 'ele');
    const elevation = rawElevation === undefined ? undefined : Number(rawElevation);
    const rawHr = childText(element, 'hr');
    const heartRate = rawHr === undefined ? undefined : Number(rawHr);
    const rawCadence = childText(element, 'cad') ?? childText(element, 'cadence');
    const cadence = rawCadence === undefined ? undefined : Number(rawCadence);
    return [{ lat, lon, ...(Number.isFinite(time) ? { time } : {}), ...(Number.isFinite(elevation) ? { elevation } : {}), ...(Number.isFinite(heartRate) ? { heartRate } : {}), ...(Number.isFinite(cadence) ? { cadence } : {}) }];
  })).filter((segment) => segment.length > 0);
  const pointCount = parsedSegments.reduce((count, segment) => count + segment.length, 0);
  if (pointCount < 2) throw new Error('GPX rotasında en az iki geçerli konum noktası bulunmalı.');

  let distanceMeters = 0;
  let movingSeconds = 0;
  let elevationGain = 0;
  const elevations: number[] = [];
  const heartRates: number[] = [];
  const cadences: number[] = [];
  const splits: GpsSplit[] = [];
  let splitDistanceMeters = 0;
  let splitMovingSeconds = 0;
  let splitNumber = 1;
  let maxSpeedMetersPerSecond = 0;
  const timedPoints: number[] = [];
  const routePoints: GpsRoutePoint[] = [];
  for (const segment of parsedSegments) {
    for (let index = 0; index < segment.length; index += 1) {
      const point = segment[index];
      if (point.time !== undefined) timedPoints.push(point.time);
      if (point.elevation !== undefined) elevations.push(point.elevation);
      if (point.heartRate !== undefined && point.heartRate > 0 && point.heartRate < 260) heartRates.push(point.heartRate);
      if (point.cadence !== undefined && point.cadence > 0 && point.cadence < 300) cadences.push(point.cadence);
      let routeDistanceMeters = distanceMeters;
      if (index > 0) {
        const previous = segment[index - 1];
        const distance = haversineMeters(previous, point);
        const elapsed = previous.time !== undefined && point.time !== undefined ? (point.time - previous.time) / 1000 : 0;
        // Keep separate GPX segments and ignore teleport/jump artifacts rather than inventing distance.
        if (elapsed > 0 && elapsed <= 300 && distance / elapsed <= 60) {
          const speed = distance / elapsed;
          distanceMeters += distance;
          routeDistanceMeters = distanceMeters;
          maxSpeedMetersPerSecond = Math.max(maxSpeedMetersPerSecond, speed);
          const isMoving = speed >= 0.5;
          if (isMoving) movingSeconds += elapsed;
          let remaining = distance;
          while (remaining > 0) {
            const chunk = Math.min(remaining, 1000 - splitDistanceMeters);
            splitDistanceMeters += chunk;
            if (isMoving) splitMovingSeconds += elapsed * chunk / distance;
            remaining -= chunk;
            if (splitDistanceMeters >= 999.99) {
              const splitSeconds = Math.round(splitMovingSeconds);
              splits.push({ number: splitNumber++, distanceKm: 1, movingSeconds: splitSeconds, paceSecondsPerKm: splitSeconds });
              splitDistanceMeters = 0;
              splitMovingSeconds = 0;
            }
          }
        } else if (elapsed === 0 && distance <= 100) {
          distanceMeters += distance;
          routeDistanceMeters = distanceMeters;
        }
        if (previous.elevation !== undefined && point.elevation !== undefined && point.elevation - previous.elevation > 1) elevationGain += point.elevation - previous.elevation;
      }
      routePoints.push({
        lat: point.lat,
        lon: point.lon,
        ...(point.time !== undefined ? { time: new Date(point.time).toISOString() } : {}),
        distanceKm: Math.round(routeDistanceMeters) / 1000,
        ...(point.elevation !== undefined ? { elevationM: point.elevation } : {}),
        ...(point.heartRate !== undefined && point.heartRate > 0 && point.heartRate < 260 ? { heartRate: point.heartRate } : {}),
        ...(point.cadence !== undefined && point.cadence > 0 && point.cadence < 300 ? { cadence: point.cadence } : {}),
      });
    }
  }
  const firstTime = timedPoints.reduce((best, time) => Math.min(best, time), Infinity);
  const lastTime = timedPoints.reduce((best, time) => Math.max(best, time), 0);
  const safeFirstTime = Number.isFinite(firstTime) ? firstTime : 0;
  const elapsedSeconds = safeFirstTime && lastTime > safeFirstTime ? Math.round((lastTime - safeFirstTime) / 1000) : Math.round(movingSeconds);
  if (distanceMeters < 30) throw new Error('GPX rotası çok kısa; en az 30 metre doğrulanabilir mesafe gerekli.');
  if (splitDistanceMeters >= 250) {
    const partialDistanceKm = splitDistanceMeters / 1000;
    const partialPace = splitDistanceMeters ? Math.round(splitMovingSeconds / partialDistanceKm) : 0;
    splits.push({ number: splitNumber, distanceKm: Math.round(partialDistanceKm * 100) / 100, movingSeconds: Math.round(splitMovingSeconds), paceSecondsPerKm: partialPace });
  }
  const sample = evenlySample(routePoints, MAX_SAVED_ROUTE_POINTS);
  const date = safeFirstTime ? (() => { const d = new Date(safeFirstTime); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : importedAt.slice(0, 10);
  return {
    id: `gpx-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
    date,
    distanceKm: Math.round(distanceMeters / 10) / 100,
    elapsedSeconds,
    movingSeconds: Math.min(elapsedSeconds || movingSeconds, Math.round(movingSeconds)),
    ...(movingSeconds > 0 ? { avgSpeedKmh: Math.round(distanceMeters / movingSeconds * 3.6 * 100) / 100 } : {}),
    ...(maxSpeedMetersPerSecond > 0 ? { maxSpeedKmh: Math.round(maxSpeedMetersPerSecond * 3.6 * 100) / 100 } : {}),
    ...(elevations.length > 1 ? { elevationGainM: Math.round(elevationGain) } : {}),
    ...(heartRates.length ? { avgHeartRate: Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length), maxHeartRate: heartRates.reduce((best, value) => Math.max(best, value), 0) } : {}),
    ...(cadences.length ? { avgCadence: Math.round(cadences.reduce((sum, value) => sum + value, 0) / cadences.length), maxCadence: cadences.reduce((best, value) => Math.max(best, value), 0) } : {}),
    ...(splits.length ? { splits } : {}),
    route: sample,
    source: 'gpx',
    fileName: fileName.slice(0, 180),
    importedAt,
  };
}

function parseXml(xml: string, format: 'TCX' | 'GPX'): Document {
  if (typeof DOMParser === 'undefined') throw new Error('Bu tarayıcı GPS/XML dosyalarını okuyamıyor.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`${format} dosyası okunamadı; geçerli bir XML dışa aktarımı seç.`);
  return document;
}

function pointToXml(point: { lat: number; lon: number; time?: string; elevation?: number; heartRate?: number; cadence?: number }) {
  return `<trkpt lat="${point.lat}" lon="${point.lon}">${point.elevation === undefined ? '' : `<ele>${point.elevation}</ele>`}${point.time ? `<time>${point.time}</time>` : ''}${point.heartRate === undefined ? '' : `<extensions><TrackPointExtension><hr>${point.heartRate}</hr>${point.cadence === undefined ? '' : `<cad>${point.cadence}</cad>`}</TrackPointExtension></extensions>`}</trkpt>`;
}

export function parseTcxActivity(xml: string, fileName: string, importedAt = new Date().toISOString()): GpsActivity {
  const document = parseXml(xml, 'TCX');
  const tracks = Array.from(document.getElementsByTagName('*')).filter((element) => element.localName.toLowerCase() === 'track');
  const sources = tracks.length ? tracks : [document.documentElement];
  const segments = sources.map((source) => Array.from(source.getElementsByTagName('*')).filter((element) => element.localName.toLowerCase() === 'trackpoint').flatMap((element) => {
    const position = Array.from(element.getElementsByTagName('*')).find((item) => item.localName.toLowerCase() === 'position');
    if (!position) return [];
    const lat = Number(childText(position, 'LatitudeDegrees'));
    const lon = Number(childText(position, 'LongitudeDegrees'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    const rawTime = childText(element, 'Time');
    const time = rawTime && Number.isFinite(Date.parse(rawTime)) ? new Date(rawTime).toISOString() : undefined;
    const rawElevation = childText(element, 'AltitudeMeters');
    const elevation = rawElevation === undefined ? undefined : Number(rawElevation);
    const rawHr = childText(element, 'Value');
    const heartRate = rawHr === undefined ? undefined : Number(rawHr);
    const rawCadence = childText(element, 'Cadence');
    const cadence = rawCadence === undefined ? undefined : Number(rawCadence);
    return [{ lat, lon, time, elevation: Number.isFinite(elevation) ? elevation : undefined, heartRate: Number.isFinite(heartRate) ? heartRate : undefined, cadence: Number.isFinite(cadence) ? cadence : undefined }];
  })).filter((segment) => segment.length);
  const gpx = `<?xml version="1.0"?><gpx>${segments.map((segment) => `<trk><trkseg>${segment.map(pointToXml).join('')}</trkseg></trk>`).join('')}</gpx>`;
  const activity = parseGpxActivity(gpx, fileName, importedAt);
  return { ...activity, id: activity.id.replace(/^gpx-/, 'tcx-'), source: 'tcx' };
}

export async function parseFitActivity(content: ArrayBuffer, fileName: string, importedAt = new Date().toISOString()): Promise<GpsActivity> {
  try {
    const { default: FitParser } = await import('fit-file-parser');
    const parser = new FitParser({ mode: 'list', speedUnit: 'm/s', lengthUnit: 'm', elapsedRecordField: true });
    const parsed = await parser.parseAsync(content);
    const records = parsed.records ?? [];
    const session = parsed.sessions?.[0];
    const points: Array<{ lat: number; lon: number; time?: string; elevation?: number; heartRate?: number; cadence?: number }> = records.flatMap((record) => {
      const lat = record.position_lat;
      const lon = record.position_long;
      if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
      const time = record.timestamp instanceof Date ? record.timestamp.toISOString() : undefined;
      return [{ lat, lon, time, elevation: record.altitude, heartRate: record.heart_rate, cadence: record.cadence }];
    });
    if (points.length < 2 && session?.start_position_lat !== undefined && session.start_position_long !== undefined && session.end_position_lat !== undefined && session.end_position_long !== undefined) {
      const startTime = session.start_time instanceof Date ? session.start_time : new Date(importedAt);
      const elapsed = Math.max(1, Math.round(session.total_elapsed_time ?? session.total_timer_time ?? 1));
      points.push({ lat: session.start_position_lat, lon: session.start_position_long, time: startTime.toISOString() });
      points.push({ lat: session.end_position_lat, lon: session.end_position_long, time: new Date(startTime.getTime() + elapsed * 1000).toISOString() });
    }
    if (points.length < 2) {
      if (!session?.total_distance || session.total_distance <= 0) throw new Error('FIT dosyasında GPS rotası veya ölçülmüş mesafe bulunamadı.');
      const startTime = session.start_time instanceof Date ? session.start_time : new Date(importedAt);
      const makeId = () => `fit-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      return {
        id: makeId(),
        date: `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`,
        distanceKm: Math.round(session.total_distance) / 1000,
        elapsedSeconds: Math.round(session.total_elapsed_time ?? session.total_timer_time ?? 0),
        movingSeconds: Math.round(session.total_timer_time ?? 0),
        ...(session.avg_speed !== undefined ? { avgSpeedKmh: Math.round(session.avg_speed * 3.6 * 100) / 100 } : {}),
        ...(session.max_speed !== undefined ? { maxSpeedKmh: Math.round(session.max_speed * 3.6 * 100) / 100 } : {}),
        ...(session.total_ascent !== undefined ? { elevationGainM: Math.round(session.total_ascent) } : {}),
        ...(session.avg_heart_rate !== undefined ? { avgHeartRate: session.avg_heart_rate } : {}),
        ...(session.max_heart_rate !== undefined ? { maxHeartRate: session.max_heart_rate } : {}),
        ...(session.avg_cadence !== undefined ? { avgCadence: session.avg_cadence } : {}),
        ...(session.max_cadence !== undefined ? { maxCadence: session.max_cadence } : {}),
        route: [], source: 'fit', fileName: fileName.slice(0, 180), importedAt,
      };
    }
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>${points.map(pointToXml).join('')}</trkseg></trk></gpx>`;
    const base = parseGpxActivity(gpx, fileName, importedAt);
    const elapsed = session?.total_elapsed_time;
    const moving = session?.total_timer_time;
    const distanceKm = session?.total_distance !== undefined && session.total_distance > 0 ? session.total_distance / 1000 : base.distanceKm;
    return {
      ...base,
      id: base.id.replace(/^gpx-/, 'fit-'),
      source: 'fit',
      distanceKm: Math.round(distanceKm * 1000) / 1000,
      ...(elapsed !== undefined && elapsed > 0 ? { elapsedSeconds: Math.round(elapsed) } : {}),
      ...(moving !== undefined && moving > 0 ? { movingSeconds: Math.round(moving) } : {}),
      ...(session?.avg_speed !== undefined ? { avgSpeedKmh: Math.round(session.avg_speed * 3.6 * 100) / 100 } : {}),
      ...(session?.max_speed !== undefined ? { maxSpeedKmh: Math.round(session.max_speed * 3.6 * 100) / 100 } : {}),
      ...(session?.total_ascent !== undefined ? { elevationGainM: Math.round(session.total_ascent) } : {}),
      ...(session?.avg_heart_rate !== undefined ? { avgHeartRate: session.avg_heart_rate } : {}),
      ...(session?.max_heart_rate !== undefined ? { maxHeartRate: session.max_heart_rate } : {}),
      ...(session?.avg_cadence !== undefined ? { avgCadence: session.avg_cadence } : {}),
      ...(session?.max_cadence !== undefined ? { maxCadence: session.max_cadence } : {}),
    };
  } catch (cause) {
    if (cause instanceof Error && /FIT|GPX|kısa/i.test(cause.message)) throw cause;
    throw new Error('FIT dosyası açılamadı veya içinden aktivite rotası çıkarılamadı. Orijinal .fit dosyasını dene.');
  }
}

export async function parseGpsDeviceFile(file: File): Promise<GpsActivity> {
  if (file.size > MAX_GPX_BYTES) throw new Error('GPS dosyası 20 MB sınırını aşıyor.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'gpx') return parseGpxActivity(await file.text(), file.name);
  if (extension === 'tcx') return parseTcxActivity(await file.text(), file.name);
  if (extension === 'fit') return parseFitActivity(await file.arrayBuffer(), file.name);
  throw new Error('Desteklenen dosyalar: .gpx, .tcx ve .fit. ZIP dışa aktarımını açıp aktivite dosyasını seç.');
}

export function loadImportedGpsActivities(): GpsActivity[] {
  return readArray<GpsActivity>(GPS_IMPORTS_KEY).filter(isGpsActivity);
}

export function saveImportedGpsActivities(activities: GpsActivity[]): boolean {
  try {
    window.localStorage.setItem(GPS_IMPORTS_KEY, JSON.stringify(activities.filter(isGpsActivity)));
    return true;
  } catch {
    return false;
  }
}
