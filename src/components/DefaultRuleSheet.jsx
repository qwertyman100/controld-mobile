import { useState } from 'react';
import { X } from 'lucide-react';
import { RULE_ACTION } from '../api/controld';
import { DEFAULT_ACTIONS, validateDefaultRule, buildDefaultRulePayload } from '../lib/defaultRule';

export default function DefaultRuleSheet({ da, proxies = [], onSave, onClose }) {
  const [action, setAction] = useState(da.do);
  const [via, setVia] = useState(da.via ?? '');
  const [error, setError] = useState(null);

  function handleSave() {
    const check = validateDefaultRule(action, { via });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    onSave(buildDefaultRulePayload(action, { via }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Default Rule</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Applies to any domain that doesn't match a rule, service, or filter.
        </p>

        <div className="flex flex-col gap-2">
          {DEFAULT_ACTIONS.map((a) => {
            const on = action === a.do;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => { setAction(a.do); setError(null); }}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  on ? `${a.bg} border-current ${a.color}` : 'bg-transparent border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`text-sm font-semibold ${on ? a.color : 'text-slate-700 dark:text-slate-200'}`}>{a.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.desc}</div>
              </button>
            );
          })}
        </div>

        {action === RULE_ACTION.BLOCK && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">
            Block makes this profile an allowlist — only domains you've allowed with a Bypass rule will resolve.
            Everything else, including brand-new domains, is denied.
          </p>
        )}

        {action === RULE_ACTION.REDIRECT && (
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Redirect location</label>
            <select
              value={via}
              onChange={(e) => { setVia(e.target.value); setError(null); }}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
            >
              <option value="">Choose a location…</option>
              {proxies.map((p) => {
                const id = p.PK ?? p.pk ?? p.id ?? p.name ?? '';
                const label = p.name ?? p.city ?? p.label ?? id;
                const country = p.country;
                return <option key={id} value={id}>{country ? `${country} — ${label}` : label}</option>;
              })}
            </select>
          </div>
        )}

        {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-green-500 text-white font-semibold text-sm py-3 rounded-xl"
        >
          Save
        </button>
      </div>
    </div>
  );
}
