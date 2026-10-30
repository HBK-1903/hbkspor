import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GpsRoutePoint } from './types';
import 'leaflet/dist/leaflet.css';
import { gpsCoordinateAtProgress } from './gps-map';

type Props = { points: GpsRoutePoint[]; progress: number; activityName: string };

/** Loaded only after a user opts into third-party OSM map tiles. */
export default function GpsLeafletMap({ points, progress, activityName }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const movingMarker = useRef<L.CircleMarker | null>(null);
  const coordinatesKey = points.map((point) => `${point.lat},${point.lon}`).join(';');

  useEffect(() => {
    const host = element.current;
    if (!host || points.length < 2) return undefined;

    const coordinates = points.map((point) => L.latLng(point.lat, point.lon));
    const map = L.map(host, {
      zoomControl: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      preferCanvas: true,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);

    const line = L.polyline(coordinates, { color: '#f97316', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    L.circleMarker(coordinates[0], { radius: 6, color: '#052e16', weight: 2, fillColor: '#86efac', fillOpacity: 1 })
      .bindTooltip('Başlangıç', { direction: 'top', offset: [0, -5] }).addTo(map);
    L.circleMarker(coordinates[coordinates.length - 1], { radius: 6, color: '#4c0519', weight: 2, fillColor: '#fb7185', fillOpacity: 1 })
      .bindTooltip('Bitiş', { direction: 'top', offset: [0, -5] }).addTo(map);
    movingMarker.current = L.circleMarker(coordinates[0], { radius: 7, color: '#082f49', weight: 2, fillColor: '#38bdf8', fillOpacity: 1 })
      .bindTooltip('Oynatım konumu', { direction: 'top', offset: [0, -6] }).addTo(map);

    const bounds = line.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.18), { maxZoom: 16 });
    else map.setView(coordinates[0], 13);
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      movingMarker.current = null;
      map.remove();
    };
  }, [coordinatesKey]);

  useEffect(() => {
    const coordinate = gpsCoordinateAtProgress(points, progress);
    if (coordinate) movingMarker.current?.setLatLng(coordinate);
  }, [progress, coordinatesKey]);

  return <div ref={element} className="route-map route-map--leaflet" role="region" aria-label={`${activityName} interaktif OpenStreetMap haritası; turuncu çizgi GPS rotası, mavi oynatım işaretçisi, yeşil başlangıç, pembe bitiş`} />;
}
