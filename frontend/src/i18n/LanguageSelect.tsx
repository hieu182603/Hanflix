import { useLanguage } from './index';
import { LANGUAGE_NAMES, isLanguage } from './messages';

export default function LanguageSelect() {
  const { lang, setLang, t } = useLanguage();
  return <select
    aria-label={t.header.language}
    value={lang}
    onChange={event => { if (isLanguage(event.target.value)) setLang(event.target.value); }}
    className="max-w-32 min-h-10 rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-700"
  >
    {Object.entries(LANGUAGE_NAMES).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
  </select>;
}
