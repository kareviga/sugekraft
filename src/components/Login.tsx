import { useState, type FormEvent } from 'react';
import { config } from '../config';
import { login, ROLE_LABEL } from '../lib/auth';
import { hasBackend } from '../lib/supabase';
import { isLive, setMode } from '../lib/mode';
import { Icon } from './Icon';
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
      <div className="loginbox">
        <section className="loginside" aria-hidden="true">
          <div className="ls-brand">
            <span className="ls-logo">
              <Logo size={44} />
            </span>
            <b>{config.company.name}</b>
          </div>
          <div>
            <h1>{tr('Oppdrag, sjåfører og rapporter – samlet på ett sted.')}</h1>
            <ul>
              <li>
                <Icon name="check" size={18} /> {tr('Kontoret planlegger og fordeler jobbene')}
              </li>
              <li>
                <Icon name="check" size={18} /> {tr('Sjåføren fører status og bilder på mobilen')}
              </li>
              <li>
                <Icon name="check" size={18} /> {tr('Kunden bestiller og følger oppdraget')}
              </li>
            </ul>
          </div>
          <small>
            {tr('Drevet av')} {config.appName}
          </small>
        </section>

        <form className="loginform" onSubmit={submit}>
          <div className="spread">
            <div className="lf-mobilebrand">
              <Logo size={36} />
              <b>{config.company.name}</b>
            </div>
            <LangSwitch light />
          </div>
          <div>
            <h2>{tr('Logg inn')}</h2>
            <p className="muted">{tr('Velkommen tilbake.')}</p>
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

          <details className="demoaccess">
            <summary>{tr('Demo-tilgang')}</summary>
            <p className="note">{tr('Trykk på en rolle for å fylle ut brukernavnet:')}</p>
            <div className="demousers">
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
            {hasBackend && (
              <div className="modesw">
                <span className={isLive() ? 'live' : 'demo'}>{isLive() ? tr('Ekte data (server)') : tr('Demo-modus (uten nett)')}</span>
                <button type="button" className="link" onClick={() => setMode(isLive() ? 'demo' : 'live')}>
                  {isLive() ? tr('Bytt til demo') : tr('Bytt til ekte data')}
                </button>
              </div>
            )}
          </details>
        </form>
      </div>
    </div>
  );
}
