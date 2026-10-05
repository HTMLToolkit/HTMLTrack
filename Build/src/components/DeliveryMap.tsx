import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TrackingPackage } from '../types/tracking';
import { statusColor } from '../lib/format';
import styles from './DeliveryMap.module.css';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';

type TileConfig = { id: string; dark: string; light: string; attribution: string };

function resolveTiles(): TileConfig {
  const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim();

  if (cartoKey) {
    const suffix = `?key=${encodeURIComponent(cartoKey)}`;
    return {
      id: 'carto',
      light: `https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png${suffix}`,
      dark: `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${suffix}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    };
  }

  return {
    id: 'esri',
    light: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    dark: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &copy; Esri, HERE, Garmin, Maxar, Earthstar Geographics',
  };
}

interface DeliveryMapProps {
  packages: TrackingPackage[];
  selectedId: string | null;
  isDark: boolean;
  onSelect: (id: string | null) => void;
}

export default function DeliveryMap({
  packages,
  selectedId,
  isDark,
  onSelect,
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const located = packages.filter((p) => p.coordinates);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const tiles = resolveTiles();
    const sourceId = `basemap-${tiles.id}`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          [sourceId]: {
            type: 'raster',
            tiles: [tiles.dark],
            tileSize: 256,
            attribution: tiles.attribution,
          },
        },
        layers: [{ id: sourceId, type: 'raster', source: sourceId }],
      },
      center: [-98.5, 39.5],
      zoom: 3,
      attributionControl: { compact: true },
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __map?: MapLibreMap }).__map = map;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', () => onSelectRef.current(null));

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const tiles = resolveTiles();
    const sourceId = `basemap-${tiles.id}`;

    const apply = () => {
      const source = map.getSource(sourceId) as
        | maplibregl.RasterTileSource
        | undefined;
      source?.setTiles([isDark ? tiles.dark : tiles.light]);
    };

    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const pkg of located) {
      const { longitude, latitude } = pkg.coordinates!;
      const isSelected = pkg.id === selectedId;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = isSelected
        ? `${styles.marker} ${styles.markerSelected}`
        : styles.marker;
      el.setAttribute('aria-label', `${pkg.carrier} ${pkg.trackingNumber}`);
      el.title = `${pkg.carrier} ${pkg.trackingNumber}`;

      const dot = document.createElement('span');
      dot.className = styles.markerDot;
      dot.style.background = statusColor(pkg.status);
      dot.textContent = pkg.trackingNumber.slice(-4);
      el.appendChild(dot);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(pkg.id);
        map.easeTo({
          center: [longitude, latitude],
          zoom: Math.max(map.getZoom(), 9),
          duration: 600,
        });
      });

      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([longitude, latitude])
          .addTo(map)
      );
    }
  }, [located, selectedId]);

  const fittedCountRef = useRef(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const countChanged = located.length !== fittedCountRef.current;
    fittedCountRef.current = located.length;

    if (!countChanged || located.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const pkg of located) {
      const { longitude, latitude } = pkg.coordinates!;
      bounds.extend([longitude, latitude]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 11,
        duration: 900,
      });
    }
  }, [located]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    const target = located.find((p) => p.id === selectedId);
    if (!target?.coordinates) return;

    map.easeTo({
      center: [target.coordinates.longitude, target.coordinates.latitude],
      zoom: Math.max(map.getZoom(), 9),
      duration: 600,
      offset: [0, -40],
    });
  }, [selectedId, located]);

  if (located.length === 0) return null;

  return (
    <section className={styles.wrapper} aria-label="Delivery map">
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.legend}>
        <span>{located.length} destination{located.length === 1 ? '' : 's'} mapped</span>
      </div>
    </section>
  );
}
