import { useEffect, useMemo, useState } from 'react';
import { config, type Role } from './config';
import { Login } from './components/Login';
import { Confirm, Logo, Toasts } from './components/ui';
import { resetDemo, useJobs } from './store';
import { logout, ROLE_LABEL, useSession } from './lib/auth';
import { toast } from './lib/toast';
import { Archive, type ArchivePreset } from './views/Archive';
import { ClientPortal } from './views/ClientPortal';
import { Clients } from './views/Clients';
import { Driver } from './views/Driver';
import { Fleet } from './views/Fleet';
import { Office } from './views/Office';
import type { View } from './types';

/** Fanene hver rolle har tilgang til */
const VIEWS: Record<Role, [View, string][]> = {
  admin: [
    ['kontor', 'Kontor'],
    ['kunder', 'Kunder'],
    ['bilpark', 'Bilpark'],
    ['sjafor', 'Sjåfør'],
    ['arkiv', 'Arkiv og faktura'],
  ],
  driver: [],
  client: [],
};
const fromHash = (role: Role): View => {
  const v = location.hash.replace(/^#\/?/, '');
  return VIEWS[role].some(([k]) => k === v) ? (v as View) : 'kontor';
};

export function App() {
  const user = useSession();
  return (
    <>
      {user ? <Shell key={user.username} /> : <Login />}
      <Toasts />
    </>
  );
}

function Shell() {
  const user = useSession()!;
  const all = useJobs();
  // bestillinger fra portalen som ikke er godtatt, holdes utenfor kontorets lister
  const jobs = useMemo(() => all.filter(j => !j.request), [all]);
  const requests = useMemo(() => all.filter(j => j.request === 'venter'), [all]);

  const [view, setView] = useState<View>(() => fromHash(user.role));
  const [officeSel, setOfficeSel] = useState<string | null>(null);
  const [driverPerson, setDriverPerson] = useState(user.driverId ?? config.drivers[0]?.id ?? '');
  const [driverJob, setDriverJob] = useState<string | null>(null);
  const [preset, setPreset] = useState<ArchivePreset | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const h = () => setView(fromHash(user.role));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [user.role]);
  const go = (v: View) => {
    if (location.hash !== `#/${v}`) location.hash = `/${v}`;
    setView(v);
    document.querySelector('main')?.scrollTo(0, 0);
  };
  const openInOffice = (id: string) => {
    setOfficeSel(id);
    go('kontor');
  };

  const isAdmin = user.role === 'admin';

  return (
    <>
      <header className="top">
        <div className="brand">
          <Logo size={34} />
          <div>
            <h1>{config.company.name}</h1>
            <span className="product">
              {user.role === 'client' ? 'Kundeportal' : 'Drevet av'} <b>{config.appName}</b>
            </span>
          </div>
        </div>
        {isAdmin && (
          <nav aria-label="Hovedmeny">
            {VIEWS.admin.map(([k, l]) => (
              <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>
                {l}
                {k === 'kontor' && requests.length > 0 && <span className="navbadge">{requests.length}</span>}
              </button>
            ))}
          </nav>
        )}
        <div className="demo">
          <span className="who">
            <b>{user.name}</b>
            <small>{ROLE_LABEL[user.role]}</small>
          </span>
          {isAdmin && (
            <button className="resetbtn" onClick={() => setConfirmReset(true)} title="Nullstill demoen">
              Nullstill demo
            </button>
          )}
          <button className="resetbtn" onClick={logout}>
            Logg ut
          </button>
        </div>
      </header>

      <main key={resetKey} className={`v-${user.role === 'admin' ? view : user.role}`}>
        {user.role === 'client' && <ClientPortal jobs={all} clientId={user.clientId ?? ''} />}

        {user.role === 'driver' && (
          <Driver
            jobs={jobs}
            personId={user.driverId ?? ''}
            lockPerson
            setPersonId={() => undefined}
            jobId={driverJob}
            setJobId={id => {
              setDriverJob(id);
              document.querySelector('main')?.scrollTo(0, 0);
            }}
          />
        )}

        {isAdmin && view === 'kontor' && (
          <Office
            jobs={jobs}
            requests={requests}
            sel={officeSel}
            setSel={setOfficeSel}
            openFleet={() => go('bilpark')}
            openAsDriver={j => {
              setDriverPerson(j.driver);
              setDriverJob(j.id);
              go('sjafor');
            }}
            openInArchive={j => {
              setPreset({ customer: j.customer, inv: j.invoiced ? 'done' : 'open', pick: j.id, n: Date.now() });
              go('arkiv');
            }}
          />
        )}
        {isAdmin && view === 'kunder' && <Clients jobs={all} openJob={openInOffice} />}
        {isAdmin && view === 'sjafor' && (
          <Driver
            jobs={jobs}
            personId={driverPerson}
            setPersonId={id => {
              setDriverPerson(id);
              setDriverJob(null);
            }}
            jobId={driverJob}
            setJobId={id => {
              setDriverJob(id);
              document.querySelector('main')?.scrollTo(0, 0);
            }}
          />
        )}
        {isAdmin && view === 'bilpark' && <Fleet jobs={jobs} openJob={openInOffice} />}
        {isAdmin && view === 'arkiv' && <Archive jobs={jobs} preset={preset} />}
      </main>

      {confirmReset && (
        <Confirm
          title="Nullstille demoen?"
          text="Alle endringer, nye jobber, kunder og bilder slettes, og eksempeldataene lastes inn på nytt."
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
    </>
  );
}
