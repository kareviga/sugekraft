import { useState } from 'react';
import { config } from '../config';
import { updateJob } from '../store';
import { nextStep, stepSideEffects, stepsFor, stepUndoEffects, type StepDef } from '../lib/steps';
import { toast } from '../lib/toast';
import { cx, dayOffset, driver, missing, nowHHMM } from '../lib/utils';
import type { Job, StepKey } from '../types';
import { Modal } from './ui';
import { tr, trd } from '../i18n';

/*
 * Tidslinje med statuspunkter. Interaktiv for sjåføren, skrivebeskyttet for kontoret/arkivet.
 */
export function StepTimeline({ j, interactive, onClosed }: { j: Job; interactive?: boolean; onClosed?: () => void }) {
  const [dlg, setDlg] = useState<{ step: StepDef; edit: boolean } | null>(null);
  const defs = stepsFor(j);
  const next = j.status === 'ferdig' ? undefined : nextStep(j);
  const doneKeys = defs.filter(s => j.steps[s.key]).map(s => s.key);
  const last = doneKeys[doneKeys.length - 1];
  const miss = missing(j);

  return (
    <div className={cx('steps', interactive && 'interactive')}>
      <ol>
        {defs.map(s => {
          const st = j.steps[s.key];
          const isNext = next?.key === s.key;
          const blocked = isNext && s.key === 'ferdig' && miss.length > 0;
          return (
            <li key={s.key} className={cx(st ? 'done' : isNext ? 'next' : 'todo')}>
              <span className="dot" aria-hidden="true">
                {st ? '✓' : ''}
              </span>
              <div className="sbody">
                <div className="shead">
                  <b>{s.label}</b>
                  {st && <span className="stime">{st.time}</span>}
                </div>
                {s.key === 'deponi' && st && j.disposal && <small className="sinfo">{trd(j.disposal)}</small>}
                {st?.comment && <small className="scomment">«{st.comment}»</small>}
                {interactive && st && j.status !== 'ferdig' && (
                  <span className="sactions">
                    <button className="link" onClick={() => setDlg({ step: s, edit: true })}>
                      {tr('Endre')}
                    </button>
                    {s.key === last && (
                      <button
                        className="link warnlink"
                        onClick={() => {
                          const steps = { ...j.steps };
                          delete steps[s.key];
                          updateJob(j.id, { steps, ...stepUndoEffects(s.key) }, true);
                          toast(tr('«{s}» er angret.', { s: s.label }));
                        }}
                      >
                        {tr('Angre')}
                      </button>
                    )}
                  </span>
                )}
                {interactive && isNext && (
                  <>
                    <button className={cx('btn stepbtn', s.key === 'ferdig' && 'finish')} disabled={blocked} onClick={() => setDlg({ step: s, edit: false })}>
                      {s.action}
                    </button>
                    {blocked && <small className="warntext">Fyll ut dokumentasjonen under før jobben kan avsluttes ({miss.length} mangler).</small>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {dlg && <StepDialog j={j} step={dlg.step} edit={dlg.edit} onClose={() => setDlg(null)} onClosed={onClosed} />}
    </div>
  );
}

export function StepDialog({ j, step, edit, onClose, onClosed }: { j: Job; step: StepDef; edit: boolean; onClose: () => void; onClosed?: () => void }) {
  const cur = j.steps[step.key];
  const [time, setTime] = useState(cur?.time ?? nowHHMM());
  const [comment, setComment] = useState(cur?.comment ?? '');
  const [depot, setDepot] = useState(j.disposal);
  const isDepot = step.key === 'deponi';
  const isFinish = step.key === 'ferdig';

  const save = () => {
    if (!time || (isDepot && !depot)) return;
    const steps = { ...j.steps, [step.key as StepKey]: { time, comment: comment.trim() } };
    const patch: Partial<Job> = { steps, ...stepSideEffects(step.key, time, depot) };
    if (isFinish && !edit) {
      if (missing({ ...j, ...patch }).length) return;
      updateJob(j.id, { ...patch, status: 'ferdig', closedAt: dayOffset(0), driverName: driver(j.driver)?.name ?? '' }, true);
      onClose();
      toast(tr('{id} er ferdig og ligger i arkivet.', { id: j.no }));
      onClosed?.();
      return;
    }
    updateJob(j.id, patch, true);
    onClose();
    toast(edit ? tr('«{s}» er oppdatert.', { s: step.label }) : `${step.label} ${time}.`);
  };

  return (
    <Modal
      title={edit ? `${tr('Endre')}: ${step.label}` : step.label}
      onClose={onClose}
      footer={
        <>
          <button className="btn alt" onClick={onClose}>
            {tr('Avbryt')}
          </button>
          <button className={cx('btn', isFinish && 'finish')} onClick={save} disabled={!time || (isDepot && !depot)}>
            {isFinish && !edit ? tr('Avslutt jobben') : tr('Lagre')}
          </button>
        </>
      }
    >
      {isFinish && !edit && <p className="note">{tr('Jobben avsluttes, flyttes til arkivet og blir klar for fakturering.')}</p>}
      <div className="field">
        <label htmlFor="st-time">{tr('Tidspunkt')}</label>
        <div className="timein">
          <input id="st-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
          <button type="button" className="now" onClick={() => setTime(nowHHMM())}>
            {tr('Nå')}
          </button>
        </div>
      </div>
      {isDepot && (
        <div className="field">
          <label htmlFor="st-depot">{tr('Deponi / mottak')}</label>
          <select id="st-depot" value={depot} onChange={e => setDepot(e.target.value)}>
            <option value="">{tr('Velg deponi')}</option>
            {config.depots.map(d => (
              <option key={d} value={d}>
                {trd(d)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="st-comment">{tr('Kommentar (valgfritt)')}</label>
        <textarea id="st-comment" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder={tr(PLACEHOLDER[step.key])} />
      </div>
    </Modal>
  );
}

const PLACEHOLDER: Record<StepKey, string> = {
  kjoring: 'F.eks. kjører fra forrige jobb',
  ankommet: 'F.eks. ventet på nøkkel, adkomst stengt',
  arbeid: 'F.eks. måtte rydde snø ved kummen',
  fullfort: 'F.eks. tanken var full, sugde to runder',
  kjortFra: '',
  deponi: 'F.eks. kø på mottaket',
  ferdig: 'Kort oppsummering',
};

/** Fast knapp nederst på skjermen med neste statuspunkt (sjåførens mobilvisning). */
export function NextStepBar({ j, onClosed }: { j: Job; onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  const next = j.status === 'ferdig' ? undefined : nextStep(j);
  if (!next) return null;
  const blocked = next.key === 'ferdig' && missing(j).length > 0;
  return (
    <>
      <div className="nextbar">
        <button className={cx('btn stepbtn', next.key === 'ferdig' && 'finish')} disabled={blocked} onClick={() => setOpen(true)}>
          {blocked ? tr('Fyll ut dokumentasjonen for å avslutte') : next.action}
        </button>
      </div>
      {open && <StepDialog j={j} step={next} edit={false} onClose={() => setOpen(false)} onClosed={onClosed} />}
    </>
  );
}
