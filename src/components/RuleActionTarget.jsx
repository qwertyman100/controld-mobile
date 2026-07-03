import { useState } from 'react';
import { RULE_ACTION } from '../api/controld';

// Shared action metadata (label + colours), incl. Spoof. Imported by CustomRules too.
export const ACTION_META = {
  [RULE_ACTION.BYPASS]:   { label: 'Bypass',   color: 'text-green-500',  bg: 'bg-green-500/10 border-green-500/25' },
  [RULE_ACTION.BLOCK]:    { label: 'Block',    color: 'text-red-500',    bg: 'bg-red-500/10 border-red-500/25' },
  [RULE_ACTION.REDIRECT]: { label: 'Redirect', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25' },
  [RULE_ACTION.SPOOF]:    { label: 'Spoof',    color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/25' },
};

const ORDER = [RULE_ACTION.BYPASS, RULE_ACTION.BLOCK, RULE_ACTION.REDIRECT, RULE_ACTION.SPOOF];

export default function RuleActionTarget({
  action, onActionChange, via, onViaChange, viaV6, onViaV6Change, proxies = [],
}) {
  const [showV6, setShowV6] = useState(!!viaV6);

  return (
    <div className="flex flex-col gap-2">
      {/* 4-action selector */}
      <div className="flex gap-2">
        {ORDER.map((val) => {
          const meta = ACTION_META[val];
          const on = action === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onActionChange(val)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                on ? `${meta.bg} ${meta.color} border-current` : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Redirect → proxy picker */}
      {action === RULE_ACTION.REDIRECT && (
        <select
          value={via ?? ''}
          onChange={(e) => onViaChange(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {proxies.length === 0 && <option value="">Loading proxies…</option>}
          {proxies.map((p) => {
            const id = p.PK ?? p.pk ?? p.id ?? p.name ?? '';
            const label = p.name ?? p.city ?? p.label ?? id;
            const country = p.country ?? p.country_name ?? p.country_code ?? '';
            return <option key={id} value={id}>{country ? `${country} — ${label}` : label}</option>;
          })}
        </select>
      )}

      {/* Spoof → IPv4/hostname target + optional IPv6 */}
      {action === RULE_ACTION.SPOOF && (
        <div className="flex flex-col gap-2">
          <input
            value={via ?? ''}
            onChange={(e) => onViaChange(e.target.value)}
            placeholder="Answer with: IPv4 or hostname (e.g. 100.64.1.5)"
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            maxLength={253}
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {showV6 ? (
            <input
              value={viaV6 ?? ''}
              onChange={(e) => onViaV6Change(e.target.value)}
              placeholder="IPv6 target (e.g. 2001:db8::1)"
              autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
              maxLength={45}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          ) : (
            <button type="button" onClick={() => setShowV6(true)} className="self-start text-xs text-purple-500 font-medium px-1">
              + Add IPv6 target
            </button>
          )}
        </div>
      )}
    </div>
  );
}
