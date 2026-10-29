import type { GpsActivity, GpsRoutePoint } from './types';
import { localDateKey } from './training';

export const MAX_GPX_BYTES = 8 * 1024 * 1024;
export const MAX_STORED_ROUTE_POINTS = 300;
const MAX_RAW_POINTS = 100_000;

export function distanceBetweenPointsKm(a: Pick<GpsRoutePoint, 'lat' | 'lon'>, b: Pick<GpsRoutePoint, 'lat' | 'lon'>): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b.lon - a.lon);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
}

/** Parse a local GPX track. The XML is parsed inertly and never executes embedded content. */
export function parseGpx(xml: string, fileName = 'gps-aktivitesi.gpx', id: string = crypto.randomUUID(), now = new Date()): GpsActivity {
  if (new Blob([xml]).size > MAX_GPX_BYTES) throw new Error('GPX dosyası 8 MB sınırını aşıyor.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX içinde desteklenmeyen XML bildirimi var.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('GPX dosyası okunamadı; XML biçimini kontrol et.');
  const elements = Array.from(document.getElementsByTagName('*'))
    .filter((element) => element.localName === 'trkpt' || element.localName === 'rtept');
  if (elements.length < 2) throw new Error('Mesafe hesaplamak için GPX içinde en az iki rota noktası gerekli.');
  if (elements.length > MAX_RAW_POINTS) throw new Error('GPX dosyasında desteklenenden fazla rota noktası var.');

  const points: GpsRoutePoint[] = elements.flatMap((element) => {
    const lat = Number(element.getAttribute('lat'));
    const lon = Number(element.getAttribute('lon'));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return [];
    const elevationText = element.getElementsByTagName('*').length
      ? Array.from(element.getElementsByTagName('*')).find((child) => child.localName === 'ele')?.textContent
      : null;
    const timeText = Array.from(element.getElementsByTagName('*')).find((child) => child.localName === 'time')?.textContent?.trim();
    const elevation = elevationText === undefined || elevationText === null ? undefined : Number(elevationText);
    const time = timeText && Number.isFinite(Date.parse(timeText)) ? new Date(timeText).toISOString() : undefined;
    return [{ lat, lon, ...(elevation !== undefined && Number.isFinite(elevation) ? { elevationM: elevation } : {}), ...(time ? { time } : {}) }];
  });
  if (points.length < 2) throw new Error('GPX dosyasında geçerli koordinatlı en az iki nokta bulunmalı.');

  let distanceKm = 0;
  const measured = points.map((point, index) => {
    if (index === 0) return point;
    const previous = points[index - 1];
    const segmentKm = distanceBetweenPointsKm(previous, point);
    distanceKm += segmentKm;
    const elapsed = previous.time && point.time ? (Date.parse(point.time) - Date.parse(previous.time)) / 1000 : 0;
    const speedKmh = elapsed > 0 && elapsed <= 600 ? segmentKm * 3600 / elapsed : undefined;
    return { ...point, ...(speedKmh !== undefined && Number.isFinite(speedKmh) ? { speedKmh } : {}) };
  });
  const timed = points.filter((point) => point.time);
  const firstTime = timed[0]?.time;
  const lastTime = timed[timed.length - 1]?.time;
  const durationSeconds = firstTime && lastTime ? Math.max(0, Math.round((Date.parse(lastTime) - Date.parse(firstTime)) / 1000)) : 0;
  const date = firstTime ? localDateKey(new Date(firstTime)) : localDateKey(now);
  const stride = Math.max(1, Math.ceil(measured.length / MAX_STORED_ROUTE_POINTS));
  const route = measured.filter((_, index) => index === 0 || index === measured.length - 1 || index % stride === 0);

  return { id, fileName: fileName.slice(0, 120), date, distanceKm: Number(distanceKm.toFixed(3)), durationSeconds, route };
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours ? `${hours} sa ${minutes} dk` : `${minutes} dk ${remainder} sn`;
}
