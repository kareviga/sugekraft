import { useState, type FormEvent } from 'react';
import { config } from '../config';
import { login, ROLE_LABEL } from '../lib/auth';
import { Logo } from './ui';

export function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!login(u, p)) setErr('Feil brukernavn eller passord.');
  };

  return (
    <div className="loginpage">
      <form className="logincard" onSubmit={submit}>
        <div className="loginbrand">
          <Logo size={48} />
          <div>
            <h1>{config.company.name}</h1>
            <span className="muted">
              Drevet av <b>{config.appName}</b>
            </span>
          </div>
        </div>
        <h2>Logg inn</h2>
        <div className="field">
          <label htmlFor="l-user">Brukernavn</label>
          <input id="l-user" autoComplete="username" autoCapitalize="none" value={u} onChange={e => setU(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="l-pass">Passord</label>
          <input id="l-pass" type="password" autoComplete="current-password" value={p} onChange={e => setP(e.target.value)} />
        </div>
        {err && <p className="alert">{err}</p>}
        <button className="btn big" type="submit">
          Logg inn
        </button>
        <div className="demousers">
          <span className="muted">Demo-brukere – trykk for å fylle ut:</span>
          <div>
            {config.users.map(x => (
              <button
                key={x.username}
                type="button"
                onClick={() => {
                  setU(x.username);
                  setP(x.password);
                  setErr('');
                }}
              >
                <b>{ROLE_LABEL[x.role]}</b>
                <small>
                  {x.username} / {x.password}
                </small>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
