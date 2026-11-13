import { config } from '../config';
import type { Job } from '../types';
import { nice, vehicleName } from './utils';
import { getLang, tr, trd } from '../i18n';
import { getPhotoUrl } from './photoCache';

/*
 * Bilder lagres som data-URL-er (JPEG) i localStorage.
 * Eksempeldataene bruker referanser som «demo:ticket» og «demo:job:3»,
 * som tegnes på canvas ved behov. Det sparer mye lagringsplass.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Liten deterministisk tilfeldighetsgenerator */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function ticketImg(j: Job): string {
  const [c, x] = canvas(800, 1060);
  const r = rng(j.id.length + +j.ticketNo.slice(-3) || 7);
  // papir med svak skygge og fold
  x.fillStyle = '#f6f3e8';
  x.fillRect(0, 0, 800, 1060);
  const g = x.createLinearGradient(0, 520, 0, 560);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(0,0,0,.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 520, 800, 40);
  x.fillStyle = config.colors.primary;
  x.fillRect(0, 0, 800, 16);
  x.fillStyle = '#222';
  x.font = 'bold 28px Arial';
  x.fillText(config.company.name.toUpperCase(), 50, 70);
  x.font = '18px Arial';
  x.fillStyle = '#555';
  x.fillText([config.company.orgNr && `Org.nr ${config.company.orgNr}`, config.company.phone].filter(Boolean).join(' · '), 50, 98);
  x.fillStyle = '#222';
  x.font = 'bold 44px Arial';
  x.fillText(tr('KJØRESEDDEL'), 50, 165);
  x.font = 'bold 30px "Courier New", monospace';
  x.fillStyle = '#b3261e';
  x.fillText('Nr. ' + (j.ticketNo || '—'), 540, 165);
  x.fillStyle = '#222';
  x.fillRect(50, 185, 700, 4);
  const rows: [string, string][] = [
    [tr('Dato'), nice(j.date)],
    [tr('Kunde'), j.customer],
    [tr('Adresse'), `${j.address}, ${j.place}`],
    [tr('Bil'), vehicleName(j.car)],
    [tr('Oppdrag'), trd(j.service)],
    [tr('Masse'), trd(j.massType)],
    [tr('Mengde'), j.amount ? `${j.amount} ${j.unit}` : ''],
    [tr('Levert'), trd(j.disposal)],
    [tr('Tid'), j.start && j.end ? `${j.start} – ${j.end}` : ''],
  ];
  rows.forEach(([k, v], i) => {
    const y = 250 + i * 78;
    x.font = '21px Arial';
    x.fillStyle = '#666';
    x.fillText(k, 50, y);
    x.fillStyle = '#9a9a9a';
    x.fillRect(200, y + 10, 550, 1);
    x.save();
    x.translate(212, y);
    x.rotate((r() - 0.5) * 0.02);
    x.font = 'italic 29px Georgia, serif';
    x.fillStyle = '#1b3f8f';
    x.fillText(String(v ?? '').slice(0, 36), 0, 0);
    x.restore();
  });
  // signatur
  x.font = '20px Arial';
  x.fillStyle = '#666';
  x.fillText(tr('Signatur sjåfør'), 50, 990);
  x.strokeStyle = '#1b3f8f';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(230, 985);
  for (let i = 0; i < 9; i++) x.quadraticCurveTo(250 + i * 30, 950 + r() * 50, 270 + i * 30, 985 - r() * 10);
  x.stroke();
  return c.toDataURL('image/jpeg', 0.75);
}

function jobImg(seed: number): string {
  const [c, x] = canvas(960, 720);
  const r = rng(seed + 3);
  const winter = seed % 3 === 0;
  // himmel og bakke
  const sky = x.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, winter ? '#c9d6e2' : '#8fb6d6');
  sky.addColorStop(1, winter ? '#eef2f4' : '#dfe9ec');
  x.fillStyle = sky;
  x.fillRect(0, 0, 960, 360);
  // fjell
  x.fillStyle = winter ? '#a8b4b8' : '#6f8a6b';
  x.beginPath();
  x.moveTo(0, 340);
  let px = 0;
  while (px < 960) {
    px += 120 + r() * 140;
    x.lineTo(px, 150 + r() * 140);
  }
  x.lineTo(960, 360);
  x.lineTo(0, 360);
  x.fill();
  if (winter) {
    x.fillStyle = '#f4f7f8';
    x.fillRect(0, 330, 960, 40);
  }
  // skog
  x.fillStyle = winter ? '#4c5f55' : '#3d5a3f';
  for (let i = 0; i < 38; i++) {
    const tx = r() * 960, th = 40 + r() * 50;
    x.beginPath();
    x.moveTo(tx, 360 - th);
    x.lineTo(tx - 14, 362);
    x.lineTo(tx + 14, 362);
    x.fill();
  }
  // grus
  const gr = x.createLinearGradient(0, 360, 0, 720);
  gr.addColorStop(0, winter ? '#d9dde0' : '#8b8678');
  gr.addColorStop(1, winter ? '#b9c0c4' : '#5f5b50');
  x.fillStyle = gr;
  x.fillRect(0, 360, 960, 360);
  // bil
  const ox = 90 + (seed % 4) * 25;
  x.fillStyle = '#c7cdd0';
  x.beginPath();
  x.roundRect(ox + 20, 300, 470, 150, 70);
  x.fill();
  x.fillStyle = '#9aa3a7';
  x.fillRect(ox + 40, 365, 430, 8);
  x.fillStyle = config.colors.primary;
  x.fillRect(ox + 500, 320, 170, 135);
  x.fillStyle = '#a9c8d6';
  x.fillRect(ox + 560, 335, 90, 50);
  x.fillStyle = '#2c3337';
  x.fillRect(ox + 10, 450, 680, 22);
  x.fillStyle = '#1b1d1e';
  [ox + 110, ox + 210, ox + 590].forEach(p => {
    x.beginPath();
    x.arc(p, 475, 42, 0, 7);
    x.fill();
    x.fillStyle = '#6b6f71';
    x.beginPath();
    x.arc(p, 475, 16, 0, 7);
    x.fill();
    x.fillStyle = '#1b1d1e';
  });
  x.fillStyle = '#fff';
  x.font = 'bold 30px Arial';
  x.fillText(config.company.name, ox + 140, 390);
  // slange og kum
  x.strokeStyle = '#2b2b2b';
  x.lineWidth = 18;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(ox + 30, 420);
  x.bezierCurveTo(ox - 60, 520, ox + 40, 640, ox + 300 + r() * 120, 610);
  x.stroke();
  x.fillStyle = '#3a3b37';
  x.beginPath();
  x.ellipse(ox + 360 + r() * 100, 625, 95, 30, 0, 0, 7);
  x.fill();
  x.fillStyle = '#6a6c66';
  x.beginPath();
  x.ellipse(ox + 360 + r() * 100, 620, 70, 18, 0, 0, 7);
  x.fill();
  // tidsstempel som fra et kamera
  x.font = 'bold 26px "Courier New", monospace';
  x.fillStyle = '#ffb000';
  x.textAlign = 'right';
  x.fillText('EKSEMPELBILDE', 930, 690);
  return c.toDataURL('image/jpeg', 0.72);
}

const cache = new Map<string, string>();

/** Gjør om en bildereferanse til noe <img>/jsPDF kan bruke. */
export function photoSrc(ref: string, j: Job): string {
  if (ref.startsWith('sb:')) return getPhotoUrl(ref.slice(3)) ?? '';
  if (!ref.startsWith('demo:')) return ref;
  const key = ref === 'demo:ticket' ? `t|${getLang()}|${j.id}|${j.ticketNo}|${j.amount}|${j.disposal}|${j.end}` : ref;
  let v = cache.get(key);
  if (!v) {
    v = ref === 'demo:ticket' ? ticketImg(j) : jobImg(+ref.split(':')[2] || 1);
    cache.set(key, v);
  }
  return v;
}

/** Skaler ned et bilde fra kamera/fil slik at det får plass i localStorage. */
/** Komprimeringsprofiler. Kjøresedler får høyere oppløsning så teksten er lesbar. */
export const PHOTO_PROFILE = {
  job: { max: 1280, maxBytes: 220_000 },
  ticket: { max: 1600, maxBytes: 350_000 },
} as const;

const dataUrlBytes = (d: string) => Math.round(((d.length - d.indexOf(',') - 1) * 3) / 4);

/**
 * Skaler ned og komprimer et bilde fra kamera/fil til JPEG under en fast størrelse.
 * Senker først kvaliteten trinnvis, deretter oppløsningen, til bildet er under grensen.
 * Typisk resultat: 120–300 kB i stedet for 3–8 MB fra mobilkameraet.
 */
export function shrink(file: File, profile: { max: number; maxBytes: number } = PHOTO_PROFILE.job): Promise<string> {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(u);
      let max = profile.max;
      let best = '';
      for (let round = 0; round < 4; round++) {
        const r = Math.min(1, max / Math.max(i.width, i.height));
        const [c, x] = canvas(Math.max(1, Math.round(i.width * r)), Math.max(1, Math.round(i.height * r)));
        x.fillStyle = '#fff'; // gjennomsiktige PNG-er får hvit bakgrunn
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(i, 0, 0, c.width, c.height);
        for (const q of [0.72, 0.62, 0.52, 0.44]) {
          best = c.toDataURL('image/jpeg', q);
          if (dataUrlBytes(best) <= profile.maxBytes) return res(best);
        }
        max = Math.round(max * 0.8);
      }
      res(best);
    };
    i.onerror = () => {
      URL.revokeObjectURL(u);
      rej(new Error('bad image'));
    };
    i.src = u;
  });
}

/** Last et bilde (f.eks. logo, også SVG) og returner PNG-data-URL + størrelse. */
export function rasterize(src: string, h = 160): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise(res => {
    if (!src) return res(null);
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => {
      try {
        const ratio = (i.naturalWidth || 1) / (i.naturalHeight || 1);
        const [c, x] = canvas(Math.round(h * ratio), h);
        x.drawImage(i, 0, 0, c.width, c.height);
        res({ data: c.toDataURL('image/png'), w: c.width, h: c.height });
      } catch {
        res(null);
      }
    };
    i.onerror = () => res(null);
    i.src = src;
  });
}

/** Bilde som data-URL (for PDF). Henter bilder fra Storage ved behov. */
export async function photoData(ref: string, j: Job): Promise<string> {
  const src = photoSrc(ref, j);
  if (!src || src.startsWith('data:')) return src;
  const blob = await (await fetch(src)).blob();
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
