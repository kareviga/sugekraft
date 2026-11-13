import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { vehicle } from '../lib/utils';
import { STATUS_LABEL, type Job } from '../types';
import { tr } from '../i18n';

/*
 * Leaflet-kart med Kartverkets topografiske kart (cache.kartverket.no, webmercator).
 * - fitKey: når denne endres, zoomes kartet til å vise alle jobbene.
 * - flyKey: når denne endres, flyttes kartet til valgt jobb.
 */

type Style = 'topo' | 'topograatone';
let rememberedStyle: Style = config.map.defaultStyle;
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function JobMap({
  jobs,
  selectedId,
  onSelect,
  fitKey,
  flyKey,
  maxFitZoom = 12,
  compact,
  tags,
}: {
  jobs: Job[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  fitKey: string;
  flyKey?: number;
  maxFitZoom?: number;
  compact?: boolean;
  /** Vis bilnummer i nålen (brukes i Bilpark, der nålene er biler) */
  tags?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const onSel = useRef(onSelect);
  onSel.current = onSelect;
  const [style] = useState<Style>(rememberedStyle);
  const [offline, setOffline] = useState(false);

  // opprett kartet én gang
  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true }).setView(config.map.center, config.map.zoom);
    m.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m);
    pins.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize({ animate: false }));
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // bakgrunnskart
  useEffect(() => {
    const m = map.current!;
    rememberedStyle = style;
    if (tiles.current) m.removeLayer(tiles.current);
    let ok = false, errs = 0;
    tiles.current = L.tileLayer(`https://cache.kartverket.no/v1/wmts/1.0.0/${style}/default/webmercator/{z}/{y}/{x}.png`, {
      maxZoom: 18,
      attribution: '© <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>',
    })
      .on('tileload', () => {
        ok = true;
        setOffline(false);
      })
      .on('tileerror', () => {
        if (!ok && ++errs >= 4) setOffline(true);
      })
      .addTo(m);
    tiles.current.bringToBack();
  }, [style]);

  // nåler
  useEffect(() => {
    const g = pins.current!;
    g.clearLayers();
    jobs.forEach(j => {
      const sel = j.id === selectedId;
      const z = tags ? (sel ? 32 : 28) : sel ? 28 : 22;
      const tag = tags ? vehicle(j.car)?.tag ?? '' : '';
      const m = L.marker([j.lat, j.lon], {
        title: `${j.no} ${j.customer} – ${tr(STATUS_LABEL[j.status])}`,
        alt: `${j.no} ${j.customer}`,
        keyboard: true,
        zIndexOffset: sel ? 1000 : j.status === 'aktiv' ? 500 : 0,
        icon: L.divIcon({
          className: '',
          iconSize: [z, z],
          iconAnchor: [z / 2, z / 2],
          html: `<div class="lpin ${j.status}${sel ? ' sel' : ''}${j.urgent && j.status !== 'ferdig' ? ' urgent' : ''}${j.request === 'venter' ? ' request' : ''}">${tag ? `<span>${tag}</span>` : ''}</div>`,
        }),
      });
      m.on('click', () => onSel.current(j.id));
      if (sel && !compact) m.bindTooltip(escapeHtml(j.customer), { permanent: true, direction: 'right', offset: [z / 2 + 4, 0], className: 'ltip' });
      else if (!compact) m.bindTooltip(escapeHtml(j.customer), { direction: 'top', offset: [0, -z / 2], className: 'ltip' });
      g.addLayer(m);
    });
  }, [jobs, selectedId, compact, tags]);

  const fit = () => {
    const m = map.current;
    if (!m) return;
    if (!jobs.length) return m.setView(config.map.center, config.map.zoom);
    m.fitBounds(L.latLngBounds(jobs.map(j => [j.lat, j.lon] as [number, number])), { padding: [46, 46], maxZoom: maxFitZoom, animate: false });
  };

  // zoom til alle når utvalget endres
  useEffect(() => {
    requestAnimationFrame(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // fly til valgt jobb
  useEffect(() => {
    if (!flyKey) return;
    const j = jobs.find(x => x.id === selectedId);
    const m = map.current;
    if (j && m) m.setView([j.lat, j.lon], Math.max(m.getZoom(), 11), { animate: !reduceMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);

  return (
    <div className="mapbox">
      <div ref={el} className="lmap" role="region" aria-label={tr('Kart over jobber')} />
      {!compact && (
      <div className="lbar">
        <button onClick={fit}>{tr('Vis alle')}</button>
      </div>
      )}
      {offline && <div className="mapnote">{tr('Bakgrunnskartet fra Kartverket kunne ikke lastes. Sjekk nettforbindelsen.')}</div>}
    </div>
  );
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
