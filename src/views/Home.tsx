import { useState } from 'react';
import { config } from '../config';
import { Icon } from '../components/Icon';
import { JobForm } from '../components/JobForm';
import { Pill } from '../components/ui';
import { useOut } from '../store';
import { progress, underway } from '../lib/steps';
import { toast } from '../lib/toast';
import { cx, dayOffset, driver, vehicle } from '../lib/utils';
import { getLang, tr, trd } from '../i18n';
import type { Job, View } from '../types';

/*
 * Forside for kontoret: rolig oversikt med det som trenger oppmerksomhet,
 * tydelige menyvalg og dagens jobber. Kartet ligger under «Jobber».
 */

export type OfficeFocus = 'kommende' | 'aktiv' | 'requests' | null;

export function Home({
  jobs,
  requests,
  name,
  go,
  openJob,
  openOffice,
}: {
  jobs: Job[];
  requests: Job[];
  name: string;
  go: (v: View) => void;
  openJob: (id: string) => void;
  openOffice: (focus: OfficeFocus) => void;
}) {
  const out = useOut();
  const [newJob, setNewJob] = useState(false);
  const today = dayOffset(0);

  const noDriver = jobs.filter(j => j.status === 'kommende');
  const running = jobs.filter(underway);
  const toInvoice = jobs.filter(j => j.status === 'ferdig' && !j.invoiced);
  const outCount = Object.keys(out).length;
  const todays = jobs
    .filter(j => j.date === today && j.status !== 'ferdig')
    .sort((a, b) => (a.steps.kjoring?.time || a.time || '99').localeCompare(b.steps.kjoring?.time || b.time || '99'));
  const doneToday = jobs.filter(j => j.status === 'ferdig' && j.closedAt === today).length;

  const h = new Date().getHours();
  const greet = h < 10 ? tr('God morgen') : h < 17 ? tr('God dag') : tr('God kveld');
  const dateText = new Date().toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });

  const attention: { n: number; title: string; text: string; icon: string; tone: string; onClick: () => void }[] = [
    { n: requests.length, title: tr('Nye bestillinger'), text: tr('Fra kunder – godta eller avvis'), icon: 'inbox', tone: 'wait', onClick: () => openOffice('requests') },
    { n: noDriver.length, title: tr('Mangler sjåfør'), text: tr('Jobber som ikke er sendt ut'), icon: 'user', tone: 'kommende', onClick: () => openOffice('kommende') },
    { n: toInvoice.length, title: tr('Klar til fakturering'), text: tr('Ferdige jobber som ikke er fakturert'), icon: 'invoice', tone: 'ferdig', onClick: () => go('arkiv') },
    { n: outCount, title: tr('Biler ute av drift'), text: tr('Verksted, kontroll e.l.'), icon: 'wrench', tone: 'warn', onClick: () => go('bilpark') },
  ];
  const needs = attention.filter(a => a.n > 0);

  const menu: { icon: string; title: string; text: string; onClick: () => void; primary?: boolean }[] = [
    { icon: 'plus', title: tr('Ny jobb'), text: tr('Registrer et oppdrag, f.eks. når en kunde ringer'), onClick: () => setNewJob(true), primary: true },
    { icon: 'map', title: tr('Jobber og kart'), text: tr('Alle oppdrag i liste og kart – tildel bil og sjåfør'), onClick: () => openOffice(null) },
    { icon: 'users', title: tr('Kunder'), text: tr('Kunderegister og kundenes bestillinger'), onClick: () => go('kunder') },
    { icon: 'truck', title: tr('Bilpark'), text: tr('Hvor bilene er og hvem som kjører'), onClick: () => go('bilpark') },
    { icon: 'invoice', title: tr('Faktura'), text: tr('Ferdige jobber og PDF-grunnlag til faktura'), onClick: () => go('arkiv') },
    { icon: 'phone', title: tr('Sjåførvisning'), text: tr('Se appen slik sjåføren ser den'), onClick: () => go('sjafor') },
  ];

  return (
    <div className="home">
      <section className="hello-row">
        <div>
          <h2>
            {greet}, {name}
          </h2>
          <p className="muted cap">{dateText}</p>
        </div>
        <div className="today-stats">
          <div>
            <b>{todays.length}</b>
            <span>{tr('jobber igjen i dag')}</span>
          </div>
          <div>
            <b>{running.length}</b>
            <span>{tr('pågår nå')}</span>
          </div>
          <div>
            <b>{doneToday}</b>
            <span>{tr('ferdig i dag')}</span>
          </div>
        </div>
      </section>

      <section aria-label={tr('Trenger oppmerksomhet')}>
        <h3 className="sec">{tr('Trenger oppmerksomhet')}</h3>
        {needs.length ? (
          <div className="attn">
            {needs.map(a => (
              <button key={a.title} className={cx('attn-card', a.tone)} onClick={a.onClick}>
                <span className="attn-ic">
                  <Icon name={a.icon} />
                </span>
                <span className="attn-n">{a.n}</span>
                <span className="attn-txt">
                  <b>{a.title}</b>
                  <small>{a.text}</small>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
          </div>
        ) : (
          <p className="allgood">
            <Icon name="check" /> {tr('Alt er under kontroll – ingenting venter på deg.')}
          </p>
        )}
      </section>

      <section aria-label={tr('Meny')}>
        <h3 className="sec">{tr('Hva vil du gjøre?')}</h3>
        <div className="tiles">
          {menu.map(m => (
            <button key={m.title} className={cx('tile', m.primary && 'primary')} onClick={m.onClick}>
              <span className="tile-ic">
                <Icon name={m.icon} size={26} />
              </span>
              <b>{m.title}</b>
              <small>{m.text}</small>
            </button>
          ))}
        </div>
      </section>

      <section aria-label={tr('Dagens jobber')}>
        <div className="spread">
          <h3 className="sec">{tr('Dagens jobber')}</h3>
          <button className="link" onClick={() => openOffice(null)}>
            {tr('Se alle i kart')} ›
          </button>
        </div>
        {todays.length ? (
          <ul className="daylist card">
            {todays.map(j => {
              const v = vehicle(j.car);
              const d = driver(j.driver);
              return (
                <li key={j.id}>
                  <button onClick={() => openJob(j.id)}>
                    <span className="dl-time">{underway(j) ? <Icon name="clock" size={16} /> : j.time || '–'}</span>
                    <span className="dl-main">
                      <b>{j.customer}</b>
                      <small>
                        {trd(j.service)} · {j.place || j.address}
                      </small>
                    </span>
                    <span className="dl-who">
                      {d ? d.name : <span className="warntext">{tr('Mangler sjåfør')}</span>}
                      <small>{underway(j) ? progress(j) : v ? v.name : ''}</small>
                    </span>
                    <Pill status={j.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="note">{tr('Ingen flere jobber i dag.')}</p>
        )}
      </section>

      <p className="note homefoot">
        {config.company.name} · {tr('Drevet av')} {config.appName}
      </p>

      {newJob && (
        <JobForm
          onClose={() => setNewJob(false)}
          onSaved={j => {
            setNewJob(false);
            toast(j.driver ? tr('{id} er lagret – {d}. Oppdraget er aktivt.', { id: j.no, d: driver(j.driver)?.name ?? '' }) : tr('{id} er lagret som kommende (ingen sjåfør ennå).', { id: j.no }));
            openJob(j.id);
          }}
        />
      )}
    </div>
  );
}
