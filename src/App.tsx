import { useEffect, useState } from 'react';
import { config } from './config';
import { Confirm, Logo, Toasts } from './components/ui';
import { resetDemo, useJobs } from './store';
import { toast } from './lib/toast';
import { Archive, type ArchivePreset } from './views/Archive';
import { Driver } from './views/Driver';
import { Office } from './views/Office';
import type { View } from './types';

const VIEWS: [View, string][] = [
  ['kontor', 'Kontor'],
  ['sjafor', 'Sjåfør'],
  ['arkiv', 'Arkiv og faktura'],
];
const fromHash = (): View => {
  const v = location.hash.replace(/^#\/?/, '');
  return VIEWS.some(([k]) => k === v) ? (v as View) : 'kontor';
};

export function App() {
  const jobs = useJobs();
  const [view, setView] = useState<View>(fromHash);
  const [officeSel, setOfficeSel] = useState<string | null>(null);
  const [driverCar, setDriverCar] = useState(config.vehicles[0]?.id ?? '');
  const [driverJob, setDriverJob] = useState<string | null>(null);
  const [preset, setPreset] = useState<ArchivePreset | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const h = () => setView(fromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (v: View) => {
    if (location.hash !== `#/${v}`) location.hash = `/${v}`;
    setView(v);
    document.querySelector('main')?.scrollTo(0, 0);
  };

  return (
    <>
      <header className="top">
        <div className="brand">
          <Logo size={34} />
          <div>
            <h1>{config.company.name}</h1>
            <span className="product">
              Drevet av <b>{config.appName}</b>
            </span>
          </div>
        </div>
        <nav aria-label="Hovedmeny">
          {VIEWS.map(([k, l]) => (
            <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>
              {l}
            </button>
          ))}
        </nav>
        <div className="demo">
          <span className="demotag">Demo</span>
          <button className="resetbtn" onClick={() => setConfirmReset(true)}>
            Nullstill demo
          </button>
        </div>
      </header>

      <main key={resetKey} className={`v-${view}`}>
        {view === 'kontor' && (
          <Office
            jobs={jobs}
            sel={officeSel}
            setSel={setOfficeSel}
            openAsDriver={j => {
              setDriverCar(j.car);
              setDriverJob(j.id);
              go('sjafor');
            }}
            openInArchive={j => {
              setPreset({ customer: j.customer, inv: j.invoiced ? 'done' : 'open', pick: j.id, n: Date.now() });
              go('arkiv');
            }}
          />
        )}
        {view === 'sjafor' && (
          <Driver
            jobs={jobs}
            carId={driverCar}
            setCarId={id => {
              setDriverCar(id);
              setDriverJob(null);
            }}
            jobId={driverJob}
            setJobId={id => {
              setDriverJob(id);
              document.querySelector('main')?.scrollTo(0, 0);
            }}
          />
        )}
        {view === 'arkiv' && <Archive jobs={jobs} preset={preset} />}
      </main>

      {confirmReset && (
        <Confirm
          title="Nullstille demoen?"
          text="Alle endringer, nye jobber og bilder slettes, og eksempeldataene lastes inn på nytt."
          ok="Nullstill"
          danger
          onClose={() => setConfirmReset(false)}
          onOk={() => {
            resetDemo();
            setOfficeSel(null);
            setDriverJob(null);
            setPreset(null);
            setResetKey(k => k + 1);
            toast('Demoen er nullstilt.');
          }}
        />
      )}
      <Toasts />
    </>
  );
}
