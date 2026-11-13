import { useState, type FormEvent } from 'react';
import { config } from '../config';
import { login, ROLE_LABEL } from '../lib/auth';
import { hasBackend } from '../lib/supabase';
import { isLive, setMode } from '../lib/mode';
import { Logo } from './ui';
import { LangSwitch } from './LangSwitch';
import { tr } from '../i18n';

export function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await login(u, p);
    setBusy(false);
    if (r === 'feil') setErr(tr('Feil brukernavn eller passord.'));
    else if (r === 'ingen-profil') setErr(tr('Brukeren er ikke koblet til et firma ennå. Kontakt kontoret.'));
    else if (r === 'nett') setErr(tr('Fikk ikke kontakt med serveren. Sjekk nettforbindelsen.'));
  };

  return (
    <div className="loginpage">
      <form className="logincard" onSubmit={submit}>
        <div className="loginbrand">
          <Logo size={48} />
          <div>
            <h1>{config.company.name}</h1>
            <span className="muted">
              {tr('Drevet av')} <b>{config.appName}</b>
            </span>
          </div>
        </div>
        <div className="spread">
          <h2>{tr('Logg inn')}</h2>
          <LangSwitch light />
        </div>
        <div className="field">
          <label htmlFor="l-user">{isLive() ? tr('E-post eller brukernavn') : tr('Brukernavn')}</label>
          <input id="l-user" autoComplete="username" autoCapitalize="none" value={u} onChange={e => setU(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="l-pass">{tr('Passord')}</label>
          <input id="l-pass" type="password" autoComplete="current-password" value={p} onChange={e => setP(e.target.value)} />
        </div>
        {err && <p className="alert">{err}</p>}
        <button className="btn big" type="submit" disabled={busy}>
          {busy ? tr('Logger inn …') : tr('Logg inn')}
        </button>
        {hasBackend && (
          <div className="modesw">
            <span className={isLive() ? 'live' : 'demo'}>{isLive() ? tr('Ekte data (server)') : tr('Demo-modus (uten nett)')}</span>
            <button type="button" className="link" onClick={() => setMode(isLive() ? 'demo' : 'live')}>
              {isLive() ? tr('Bytt til demo') : tr('Bytt til ekte data')}
            </button>
          </div>
        )}
        <div className="demousers">
          <span className="muted">{tr('Demo-brukere – trykk for å fylle ut brukernavn:')}</span>
          <div>
            {config.users.map(x => (
              <button
                key={x.username}
                type="button"
                onClick={() => {
                  setU(x.username);
                  setErr('');
                  document.getElementById('l-pass')?.focus();
                }}
              >
                <b>{tr(ROLE_LABEL[x.role])}</b>
                <small>{x.username}</small>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
