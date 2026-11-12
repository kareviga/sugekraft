import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { tr } from '../i18n';

/*
 * Lite kart i jobbskjemaet. Klikk i kartet eller dra nålen for å plassere jobben.
 * focusKey endres når posisjonen kommer fra adressesøket, så kartet zoomer dit.
 */

export interface Pos {
  lat: number;
  lon: number;
}

const pinIcon = L.divIcon({
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  html: '<div class="fpin"><span></span></div>',
});

export function PinPicker({ pos, onPick, focusKey }: { pos: Pos | null; onPick: (p: Pos) => void; focusKey: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true }).setView(pos ? [pos.lat, pos.lon] : config.map.center, pos ? 16 : config.map.zoom);
    m.attributionControl.setPrefix(false);
    L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>',
    }).addTo(m);
    m.on('click', e => pick.current({ lat: e.latlng.lat, lon: e.latlng.lng }));
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize({ animate: false }));
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hold nålen i synk med posisjonen
  useEffect(() => {
    const m = map.current!;
    if (!pos) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([pos.lat, pos.lon], { draggable: true, icon: pinIcon, keyboard: false })
        .on('dragend', () => {
          const p = marker.current!.getLatLng();
          pick.current({ lat: p.lat, lon: p.lng });
        })
        .addTo(m);
    } else marker.current.setLatLng([pos.lat, pos.lon]);
  }, [pos]);

  // zoom til adressen som ble valgt
  useEffect(() => {
    if (focusKey && pos && map.current) map.current.setView([pos.lat, pos.lon], 17, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        setLocating(false);
        const q = { lat: p.coords.latitude, lon: p.coords.longitude };
        pick.current(q);
        map.current?.setView([q.lat, q.lon], 17, { animate: false });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="picker">
      <div ref={el} className="pickmap" aria-label={tr('Kart for å plassere jobben. Klikk for å sette nålen.')} />
      {'geolocation' in navigator && (
        <button type="button" className="locate" onClick={locate} disabled={locating}>
          {locating ? 'Finner posisjon …' : '◎ Min posisjon'}
        </button>
      )}
      {!pos && <div className="pickhint">{tr('Klikk i kartet for å plassere nålen')}</div>}
    </div>
  );
}
