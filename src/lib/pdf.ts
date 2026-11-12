import { jsPDF } from 'jspdf';
import { config } from '../config';
import type { Job } from '../types';
import { photoSrc, rasterize } from './photos';
import { dayOffset, download, fmtAmount, hexToRgb, hours, nice, num, totals, vehicle } from './utils';

/*
 * Fakturagrunnlag som PDF:
 *  - Samleside med kundeinfo, tabell over alle jobber og summer
 *  - Én side per jobb med alle felter, kjøreseddel og bilder
 */

const INK: [number, number, number] = [28, 42, 48];
const MUTED: [number, number, number] = [100, 112, 116];
// Standardfontene i jsPDF støtter Latin-1. Bytt ut tegn som ikke finnes der.
const t = (s: unknown) => String(s ?? '').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/⚠/g, '');

export async function buildInvoicePdf(list: Job[]): Promise<{ doc: jsPDF; filename: string }> {
  const jobs = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const d = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 14, W = 182, R = L + W;
  const brand = hexToRgb(config.colors.primary);
  const logo = await rasterize(config.logo, 200);
  const cust = jobs[0].customer;
  const first = jobs[0], last = jobs[jobs.length - 1];

  const header = (title: string, sub?: string) => {
    d.setFillColor(...brand);
    d.rect(0, 0, 210, 4, 'F');
    let tx = L;
    if (logo) {
      const h = 11, w = (logo.w / logo.h) * h;
      d.addImage(logo.data, 'PNG', L, 9, w, h);
      tx = L + w + 4;
    }
    d.setFont('helvetica', 'bold');
    d.setFontSize(13);
    d.setTextColor(...INK);
    d.text(t(config.company.name), tx, 14);
    d.setFont('helvetica', 'normal');
    d.setFontSize(8);
    d.setTextColor(...MUTED);
    d.text(t(`Org.nr ${config.company.orgNr}`), tx, 18.5);
    d.text(t(config.company.address), R, 12, { align: 'right' });
    d.text(t(`${config.company.phone} · ${config.company.email}`), R, 16, { align: 'right' });
    d.text(t(config.company.web), R, 20, { align: 'right' });
    d.setDrawColor(215, 222, 220);
    d.setLineWidth(0.3);
    d.line(L, 24, R, 24);
    d.setFont('helvetica', 'bold');
    d.setFontSize(17);
    d.setTextColor(...INK);
    d.text(t(title), L, 34);
    if (sub) {
      d.setFont('helvetica', 'normal');
      d.setFontSize(9.5);
      d.setTextColor(...MUTED);
      d.text(t(sub), L, 40);
    }
    d.setTextColor(...INK);
  };

  // ---------- samleside ----------
  header('Fakturagrunnlag', `Vedlegg til faktura · Utskrevet ${nice(dayOffset(0))}`);

  // kundeboks
  d.setFillColor(243, 246, 245);
  d.roundedRect(L, 45, W, 24, 1.5, 1.5, 'F');
  const box = (label: string, val: string, x: number, y: number) => {
    d.setFontSize(8);
    d.setTextColor(...MUTED);
    d.text(t(label), x, y);
    d.setFontSize(10.5);
    d.setTextColor(...INK);
    d.setFont('helvetica', 'bold');
    d.text(t(val), x, y + 5);
    d.setFont('helvetica', 'normal');
  };
  box('Kunde', cust, L + 4, 51);
  box('Kontaktperson', first.contact || '-', L + 98, 51);
  box('Periode', `${nice(first.date)} - ${nice(last.date)}`, L + 4, 62);
  box('Antall jobber', String(jobs.length), L + 98, 62);
  const refs = [...new Set(jobs.map(j => j.ref).filter(Boolean))];
  box('Kundens referanser', refs.length ? refs.join(', ').slice(0, 40) : '-', L + 140, 62);

  // tabell
  const cols: [string, number, ('r' | undefined)?][] = [
    ['Jobb', 16],
    ['Dato', 19],
    ['Ref.', 18],
    ['Sted / adresse', 34],
    ['Oppdrag', 30],
    ['Masse', 28],
    ['Mengde', 15, 'r'],
    ['Kj.sed.', 12],
    ['Timer', 10, 'r'],
  ];
  let y = 80;
  const thead = () => {
    d.setFillColor(...brand);
    d.rect(L, y - 4.5, W, 7, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(8.5);
    d.setTextColor(255, 255, 255);
    let x = L + 1.5;
    cols.forEach(([h, w, a]) => {
      d.text(h, a === 'r' ? x + w - 3 : x, y, a === 'r' ? { align: 'right' } : undefined);
      x += w;
    });
    d.setFont('helvetica', 'normal');
    d.setTextColor(...INK);
    y += 7;
  };
  thead();
  d.setFontSize(8.5);
  jobs.forEach((j, idx) => {
    const vals = [j.id, nice(j.date), j.ref || '-', `${j.address}, ${j.place}`, j.service, j.massType.replace(/ \(kun spyling\/inspeksjon\)/, ''), t(fmtAmount(j)), j.ticketNo, num(hours(j))];
    const wr = vals.map((v, i) => d.splitTextToSize(t(v), cols[i][1] - 2.5) as string[]);
    const n = Math.max(...wr.map(a => a.length));
    const h = n * 3.7 + 2.6;
    if (y + h > 262) {
      d.addPage();
      header('Fakturagrunnlag (forts.)', cust);
      y = 52;
      thead();
      d.setFontSize(8.5);
    }
    if (idx % 2) {
      d.setFillColor(246, 248, 247);
      d.rect(L, y - 3.8, W, h, 'F');
    }
    let x = L + 1.5;
    wr.forEach((a, i) => {
      const right = cols[i][2] === 'r';
      d.text(a, right ? x + cols[i][1] - 3 : x, y, right ? { align: 'right' } : undefined);
      x += cols[i][1];
    });
    y += h;
  });
  d.setDrawColor(...brand);
  d.setLineWidth(0.4);
  d.line(L, y - 2.5, R, y - 2.5);

  // summer
  const sum = totals(jobs);
  const lines: [string, string][] = [['Arbeidstimer totalt', num(sum.hours) + ' t']];
  Object.entries(sum.amounts).forEach(([k, v]) => lines.push([k, num(v)]));
  lines.push(['Bilder og kjøresedler (vedlagt)', String(sum.photos)]);
  if (y + 10 + lines.length * 6 > 275) {
    d.addPage();
    header('Fakturagrunnlag (forts.)', cust);
    y = 52;
  } else y += 6;
  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.text('Sammendrag', L, y);
  y += 6;
  d.setFontSize(9.5);
  lines.forEach(([a, b]) => {
    d.setFont('helvetica', 'normal');
    d.text(t(a), L, y);
    d.setFont('helvetica', 'bold');
    d.text(t(b), L + 110, y, { align: 'right' });
    d.setDrawColor(225, 230, 228);
    d.setLineWidth(0.2);
    d.line(L, y + 1.8, L + 110, y + 1.8);
    y += 6;
  });
  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  d.setTextColor(...MUTED);
  d.text('Dokumentasjon for hver jobb følger på de neste sidene.', L, y + 4);
  d.setTextColor(...INK);

  // ---------- én side per jobb ----------
  for (const j of jobs) {
    d.addPage();
    header(`${j.id} · ${j.service}`, `${cust} · ${nice(j.date)}`);
    const v = vehicle(j.car);
    const f: [string, string][] = [
      ['Kunde', j.customer],
      ['Kontakt', [j.contact, j.phone].filter(Boolean).join(', ')],
      ['Adresse', `${j.address}, ${j.place}`],
      ['Kundens ref.', j.ref],
      ['Dato', nice(j.date)],
      ['Tid', j.start && j.end ? `${j.start} - ${j.end} (${num(hours(j))} t)` : '-'],
      ['Bil / sjåfør', `${v ? `${v.name} (${v.regNr})` : '-'} / ${j.driverName || '-'}`],
      ['Kjøreseddel', j.ticketNo],
      ['Masse', j.massType],
      ['Mengde', fmtAmount(j)],
      ['Deponi / mottak', j.disposal || '-'],
    ];
    if (j.decl) f.push(['Deklarasjonsnr.', j.decl]);
    if (j.comment) f.push(['Kommentar', j.comment]);
    let yy = 48;
    d.setFontSize(9.5);
    // to kolonner for korte felt, kommentar over full bredde
    const half = W / 2;
    let col = 0, rowH = 0;
    const endRow = () => {
      yy += rowH;
      col = 0;
      rowH = 0;
    };
    f.forEach(([k, val]) => {
      const full = k === 'Kommentar' || k === 'Adresse';
      if (full && col === 1) endRow();
      const x = L + col * half;
      d.setTextColor(...MUTED);
      d.setFontSize(7.5);
      d.text(t(k).toUpperCase(), x, yy);
      d.setTextColor(...INK);
      d.setFontSize(10);
      const txt = d.splitTextToSize(t(val || '-'), (full ? W : half) - 4) as string[];
      d.text(txt, x, yy + 4.5);
      rowH = Math.max(rowH, 6 + txt.length * 4.4);
      if (full || col === 1) endRow();
      else col = 1;
    });
    if (col === 1) endRow();
    yy += 2;
    d.setDrawColor(215, 222, 220);
    d.line(L, yy, R, yy);
    yy += 6;

    const pics: [string, string][] = [
      ...j.ticketPhotos.map((p, i) => [p, `Kjøreseddel${j.ticketPhotos.length > 1 ? ' ' + (i + 1) : ''}`] as [string, string]),
      ...j.jobPhotos.map((p, i) => [p, `Bilde ${i + 1}`] as [string, string]),
    ];
    const gap = 6, bw = (W - gap) / 2, bh = 92;
    let i = 0;
    for (const [ref, cap] of pics) {
      if (i % 2 === 0 && i > 0) yy += bh + 10;
      if (yy + bh + 6 > 284) {
        d.addPage();
        header(`${j.id} · bilder (forts.)`, `${cust} · ${nice(j.date)}`);
        yy = 48;
        i = 0;
      }
      const src = photoSrc(ref, j);
      try {
        const pr = d.getImageProperties(src);
        const r = Math.min(bw / pr.width, bh / pr.height);
        const iw = pr.width * r, ih = pr.height * r;
        const x0 = L + (i % 2) * (bw + gap);
        d.setFillColor(243, 246, 245);
        d.rect(x0, yy, bw, bh, 'F');
        d.addImage(src, src.startsWith('data:image/png') ? 'PNG' : 'JPEG', x0 + (bw - iw) / 2, yy + (bh - ih) / 2, iw, ih);
        d.setFontSize(8);
        d.setTextColor(...MUTED);
        d.text(t(cap), x0, yy + bh + 4);
        d.setTextColor(...INK);
      } catch {
        /* hopp over bilder som ikke kan leses */
      }
      i++;
    }
  }

  // bunntekst
  const n = d.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    d.setPage(p);
    d.setFontSize(7.5);
    d.setTextColor(...MUTED);
    d.text(t(`${config.company.name} · Fakturagrunnlag ${cust}`), L, 291);
    d.text(`Side ${p} av ${n}`, R, 291, { align: 'right' });
  }

  return { doc: d, filename: `Fakturagrunnlag_${download(cust)}_${dayOffset(0)}.pdf` };
}
