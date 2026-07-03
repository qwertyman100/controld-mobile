import { useState } from 'react';
import { X } from 'lucide-react';
import { RULE_ACTION } from '../api/controld';
import { validateSpoofTarget, buildRulePayload } from '../lib/rules';
import RuleActionTarget from './RuleActionTarget';

export default function RuleEditSheet({ rule, proxies, onSave, onClose }) {
  const [action, setAction] = useState(rule.do);
  const [via, setVia] = useState(rule.via ?? '');
  const [viaV6, setViaV6] = useState(rule.via_v6 ?? '');
  const [error, setError] = useState(null);

  function handleSave() {
    if (action === RULE_ACTION.SPOOF) {
      const v = validateSpoofTarget(via);
      if (!v.ok) { setError(v.error); return; }
      if (viaV6) {
        const v6 = validateSpoofTarget(viaV6, { ipv6: true });
        if (!v6.ok) { setError(v6.error); return; }
      }
    }
    onSave(buildRulePayload(action, { via, viaV6 }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{String(rule.hostname)}</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <RuleActionTarget
          action={action}
          onActionChange={(a) => { setAction(a); setError(null); }}
          via={via} onViaChange={(v) => { setVia(v); setError(null); }}
          viaV6={viaV6} onViaV6Change={(v) => { setViaV6(v); setError(null); }}
          proxies={proxies}
        />
        {error ? <p role="alert" className="text-xs text-red-400 mt-2 px-1">{error}</p> : null}
        <button onClick={handleSave} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl py-3 text-sm">
          Save
        </button>
      </div>
    </div>
  );
}
