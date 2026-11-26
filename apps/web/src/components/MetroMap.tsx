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
  /** Called when the marker is tapped (for example to remove a pin). */
  onTap?: () => void;
}

interface Props {
  markers?: MapMarker[];
  /** Station ids of the route to highlight, in order. */
  route?: string[];
  /** The route's legs, so each part is drawn in its line colour. */
  legs?: { line: LineId; stations: string[] }[];
  tiles: boolean;
  /** Pixels at the bottom covered by the sheet, kept clear when fitting the route. */
  bottomPad?: number;
  /** The rider's position during live tracking. */
  track?: LatLng | null;
  follow?: boolean;
  /** Called when the user drags the map, so following can stop. */
  onDrag?: () => void;
  onPick?: (p: LatLng) => void;
  /** Called when a station dot is tapped. */
  onStation?: (s: Station) => void;
  /** False when the map is hidden behind another tab; triggers invalidateSize on re-show. */
  visible?: boolean;
}

const CAIRO: L.LatLngTuple = [30.05, 31.25];

export function MetroMap({
  markers = [],
  route,
  legs,
  tiles,
  bottomPad = 0,
  track = null,
  follow = false,
  onDrag,
  onPick,
  onStation,
  visible = true,
}: Props) {
  const padRef = useRef(bottomPad);
  padRef.current = bottomPad;
  const { lang, t } = useI18n();
  const { highlightColour, stationLabels } = useSettings();
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
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const meRef = useRef<L.CircleMarker | null>(null);
  const dragRef = useRef(onDrag);
  dragRef.current = onDrag;
  const trackRef = useRef<L.Marker | null>(null);
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
    map.on('dragstart', () => dragRef.current?.());
    map.on('click', (e: L.LeafletMouseEvent) =>
      pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    return () => {
      map.remove();
      baseRef.current = [];
      meRef.current = null;
      trackRef.current = null;
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

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [visible]);

  // Live tracking: a pulsing dot that the map follows while following is on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!track) {
      trackRef.current?.remove();
      trackRef.current = null;
      return;
    }
    const ll: L.LatLngTuple = [track.lat, track.lng];
    if (trackRef.current) trackRef.current.setLatLng(ll);
    else {
      trackRef.current = L.marker(ll, {
        icon: L.divIcon({ className: 'track-dot', html: '<span></span>', iconSize: [22, 22] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
    if (follow) {
      // keep the dot in the part of the map the sheet does not cover
      const z = Math.max(map.getZoom(), 15);
      const target = map.project(ll, z).add([0, padRef.current / 2]);
      map.setView(map.unproject(target, z), z, { animate: true });
    }
  }, [track, follow]);

  const locate = () => {
    setLocating(true);
    setLocError('');
    const request = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
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
        (err) => {
          if (highAccuracy && err.code !== 1) {
            request(false);
            return;
          }
          setLocating(false);
          setLocError(err.code === 1 ? t('locationDenied') : t('locationUnavailable'));
        },
        highAccuracy
          ? { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
          : { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
      );
    };
    request(true);
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
      const showName =
        (onRoute && stationLabels !== 'off') ||
        (!dim &&
          (stationLabels === 'always' ||
            (stationLabels === 'zoom' && (zoom >= 14 || (s.interchange && zoom >= 11)))));
      marker.bindTooltip(stationName(s, lang), {
        permanent: showName,
        direction: lang === 'ar' ? 'left' : 'right',
        offset: [lang === 'ar' ? -6 : 6, 0],
        className: `st-label${onRoute ? ' on-route' : ''}${zoom < 13 ? ' small' : ''}`,
      });
      marker
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          stationRef.current?.(s);
        })
        .addTo(group);
      if (stationRef.current) {
        const el = marker.getElement();
        el?.setAttribute('tabindex', '0');
        el?.setAttribute('role', 'button');
        el?.setAttribute('aria-label', stationName(s, lang));
        el?.addEventListener('keydown', (e: Event) => {
          const k = e as KeyboardEvent;
          if (k.key === 'Enter' || k.key === ' ') {
            e.preventDefault();
            stationRef.current?.(s);
          }
        });
      }
    }
    return () => {
      group.remove();
    };
  }, [lang, routeSet, zoom, stationLabels]);

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
      const dot = L.circleMarker([m.point.lat, m.point.lng], {
        bubblingMouseEvents: !m.onTap,
        radius: m.primary ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: m.colour ?? '#e11d48',
        fillOpacity: 1,
      })
        .bindTooltip(m.label, { permanent: Boolean(m.primary), direction: 'top' })
        .addTo(group);
      if (m.onTap) dot.on('click', m.onTap);
      bounds.push([m.point.lat, m.point.lng]);
    }
    if (bounds.length > 0)
      map.fitBounds(L.latLngBounds(bounds), {
        paddingTopLeft: [40, padRef.current > 0 ? 72 : 40],
        paddingBottomRight: [40, 40 + padRef.current],
        maxZoom: 16,
      });
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
          <button
            type="button"
            aria-label={locating ? t('locating') : t('locateMe')}
            title={locating ? t('locating') : t('locateMe')}
            disabled={locating}
            onClick={locate}
          >
            {locating ? '…' : '◎'}
          </button>
        )}
      </div>
      {locError && (
        <p className="map-error" role="alert">
          {locError}
        </p>
      )}
    </div>
  );
}
