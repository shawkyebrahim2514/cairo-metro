import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng, Station } from '@cairo-metro/core';
import { lineColour, metro, stationsById } from '../data';
import { stationName, useI18n } from '../i18n';

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
  tiles: boolean;
  onPick?: (p: LatLng) => void;
  /** Called when a station dot is tapped. */
  onStation?: (s: Station) => void;
}

const CAIRO: L.LatLngTuple = [30.05, 31.25];

export function MetroMap({ markers = [], route, tiles, onPick, onStation }: Props) {
  const { lang, t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const dynamicRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
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
        L.polyline(pts, { color: lineColour.get(line.id), weight: 4, opacity: 0.85 }).addTo(map);
      }
    }
    map.on('click', (e: L.LeafletMouseEvent) =>
      pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      dynamicRef.current = null;
    };
  }, []);

  // Station dots are redrawn when the language changes so tooltips use the right name.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    for (const s of metro.stations) {
      L.circleMarker([s.lat, s.lng], {
        radius: s.interchange ? 6 : 4,
        color: lineColour.get(s.lines[0]!.line) ?? '#333',
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(stationName(s, lang))
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          stationRef.current?.(s);
        })
        .addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [lang]);

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
      const pts = route.map((id): L.LatLngTuple => {
        const s = stationsById.get(id)!;
        return [s.lat, s.lng];
      });
      L.polyline(pts, { color: '#111', weight: 9, opacity: 0.3 }).addTo(group);
      bounds.push(...pts);
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
  }, [markers, route]);

  return <div className="map" ref={hostRef} role="region" aria-label={t('mapLabel')} />;
}
