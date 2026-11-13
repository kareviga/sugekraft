import { useState, type FormEvent } from 'react';
import { config } from '../config';
import { login, ROLE_LABEL } from '../lib/auth';
import { Logo } from './ui';
import { LangSwitch } from './LangSwitch';
import { tr } from '../i18n';

export function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!login(u, p)) setErr(tr('Feil brukernavn eller passord.'));
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
          <label htmlFor="l-user">{tr('Brukernavn')}</label>
          <input id="l-user" autoComplete="username" autoCapitalize="none" value={u} onChange={e => setU(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="l-pass">{tr('Passord')}</label>
          <input id="l-pass" type="password" autoComplete="current-password" value={p} onChange={e => setP(e.target.value)} />
        </div>
        {err && <p className="alert">{err}</p>}
        <button className="btn big" type="submit">
          {tr('Logg inn')}
        </button>
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
