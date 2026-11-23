import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng, LineId, Station } from '@cairo-metro/core';
import { lineColour, metro, stationsById } from '../data';
import { stationName, useI18n } from '../i18n';
import { useSettings } from '../settings';

export interface MapMarker {
  point: LatLng;
  label: string;
  colour?: string;
  /** Larger marker with a permanent label, for the user's origin/destination. */
  primary?: boolean;
}

interface Props {
  markers?: MapMarker[];
  /** Station ids of the route to highlight, in order. */
  route?: string[];
  /** The route's legs, so each part is drawn in its line colour. */
  legs?: { line: LineId; stations: string[] }[];
  tiles: boolean;
  onPick?: (p: LatLng) => void;
  /** Called when a station dot is tapped. */
  onStation?: (s: Station) => void;
}

const CAIRO: L.LatLngTuple = [30.05, 31.25];

export function MetroMap({ markers = [], route, legs, tiles, onPick, onStation }: Props) {
  const { lang, t } = useI18n();
  const { highlightColour } = useSettings();
  const baseRef = useRef<L.Polyline[]>([]);
  const [zoom, setZoom] = useState(11);
  const routeSet = useMemo(() => new Set(route ?? []), [route]);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const [full, setFull] = useState(false);
  const meRef = useRef<L.CircleMarker | null>(null);
  const stationRef = useRef(onStation);
  stationRef.current = onStation;

  useEffect(() => {
    if (!hostRef.current) return;
    const map = L.map(hostRef.current).setView(CAIRO, 11);
    map.attributionControl.setPrefix(false);
    mapRef.current = map;
    dynamicRef.current = L.layerGroup().addTo(map);

    for (const line of metro.lines) {
      for (const branch of line.branches) {
        const pts = branch.stations.map((id): L.LatLngTuple => {
          const s = stationsById.get(id)!;
          return [s.lat, s.lng];
        });
        baseRef.current.push(
          L.polyline(pts, { color: lineColour.get(line.id), weight: 5, opacity: 0.85 }).addTo(map),
        );
      }
    }
    map.on('zoomend', () => setZoom(map.getZoom()));
    map.on('click', (e: L.LeafletMouseEvent) =>
      pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    return () => {
      map.remove();
      baseRef.current = [];
      meRef.current = null;
      mapRef.current = null;
      tileRef.current = null;
      dynamicRef.current = null;
    };
  }, []);

  // Station dots are redrawn when the language changes so tooltips use the right name.
  // The container size changes when the map is expanded or collapsed.
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    if (!full) return () => cancelAnimationFrame(id);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [full]);

  const locate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const ll: L.LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        meRef.current?.remove();
        meRef.current = L.circleMarker(ll, {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map);
        map.setView(ll, Math.max(map.getZoom(), 15));
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Dim the plain lines while a route is shown so the route stands out.
  useEffect(() => {
    const hasRoute = Boolean(route && route.length > 1);
    for (const l of baseRef.current) l.setStyle({ opacity: hasRoute ? 0.28 : 0.85 });
  }, [route]);

  // Station dots and names beside them: names appear by zoom level, route stations always.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const hasRoute = routeSet.size > 0;
    for (const s of metro.stations) {
      const onRoute = routeSet.has(s.id);
      const dim = hasRoute && !onRoute;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: onRoute ? 6 : s.interchange ? 6 : 4,
        color: s.interchange ? '#111' : (lineColour.get(s.lines[0]!.line) ?? '#333'),
        weight: onRoute ? 3 : 2,
        fillColor: '#fff',
        fillOpacity: dim ? 0.4 : 1,
        opacity: dim ? 0.4 : 1,
      });
      const showName = onRoute || (!dim && (zoom >= 14 || (s.interchange && zoom >= 11)));
      marker.bindTooltip(stationName(s, lang), {
        permanent: showName,
        direction: lang === 'ar' ? 'left' : 'right',
        offset: [lang === 'ar' ? -6 : 6, 0],
        className: `st-label${onRoute ? ' on-route' : ''}`,
      });
      marker
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          stationRef.current?.(s);
        })
        .addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [lang, routeSet, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tiles && !tileRef.current) {
      tileRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      tileRef.current.bringToBack();
    } else if (!tiles && tileRef.current) {
      tileRef.current.remove();
      tileRef.current = null;
    }
  }, [tiles]);

  useEffect(() => {
    const map = mapRef.current;
    const group = dynamicRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    if (route && route.length > 1) {
      const toPts = (ids: string[]) =>
        ids.map((id): L.LatLngTuple => {
          const s = stationsById.get(id)!;
          return [s.lat, s.lng];
        });
      const segments = legs?.length
        ? legs.map((l) => ({ pts: toPts(l.stations), colour: lineColour.get(l.line) ?? '#333' }))
        : [{ pts: toPts(route), colour: '#333' }];
      const round = { lineCap: 'round', lineJoin: 'round' } as const;
      // Glow, white casing, line colour, then moving dots, so the route reads clearly on any theme.
      for (const seg of segments)
        L.polyline(seg.pts, { color: highlightColour, weight: 18, opacity: 0.55, ...round }).addTo(
          group,
        );
      for (const seg of segments)
        L.polyline(seg.pts, { color: '#fff', weight: 11, opacity: 1, ...round }).addTo(group);
      for (const seg of segments)
        L.polyline(seg.pts, { color: seg.colour, weight: 6, opacity: 1, ...round }).addTo(group);
      for (const seg of segments)
        L.polyline(seg.pts, {
          color: '#fff',
          weight: 2,
          dashArray: '1 11',
          className: 'route-flow',
          ...round,
        }).addTo(group);
      bounds.push(...toPts(route));
    }
    for (const m of markers) {
      L.circleMarker([m.point.lat, m.point.lng], {
        radius: m.primary ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: m.colour ?? '#e11d48',
        fillOpacity: 1,
      })
        .bindTooltip(m.label, { permanent: Boolean(m.primary), direction: 'top' })
        .addTo(group);
      bounds.push([m.point.lat, m.point.lng]);
    }
    if (bounds.length > 0)
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
  }, [markers, route, legs, highlightColour]);

  return (
    <div className={full ? 'map-wrap full' : 'map-wrap'}>
      <div className="map" ref={hostRef} role="region" aria-label={t('mapLabel')} />
      <div className="map-tools">
        <button
          type="button"
          aria-label={full ? t('collapseMap') : t('expandMap')}
          title={full ? t('collapseMap') : t('expandMap')}
          onClick={() => setFull(!full)}
        >
          {full ? '✕' : '⛶'}
        </button>
        {'geolocation' in navigator && (
          <button type="button" aria-label={t('locateMe')} title={t('locateMe')} onClick={locate}>
            ◎
          </button>
        )}
      </div>
    </div>
  );
}
