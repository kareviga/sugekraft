import { setLang, useLang } from '../i18n';

/** Språkvalg NO | EN. Valget huskes i nettleseren. */
export function LangSwitch({ light }: { light?: boolean }) {
  const lang = useLang();
  return (
    <div className={`langsw${light ? ' light' : ''}`} role="group" aria-label="Språk / Language">
      <button type="button" aria-pressed={lang === 'no'} onClick={() => setLang('no')}>
        NO
      </button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}
