import { useState } from 'react';
import { X } from 'lucide-react';
import { resolveDefaultLocation } from '../lib/services';

const ACTIONS = [
  { key: 'block', label: 'Block', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  { key: 'bypass', label: 'Bypass', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  { key: 'redirect', label: 'Redirect', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
];

export default function ServiceActionSheet({ service, proxies, onChoose, onClose }) {
  const def = resolveDefaultLocation(service, proxies);
  const [via, setVia] = useState(service.via || def?.PK || (proxies[0]?.PK ?? ''));
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');

  const chosen = proxies.find((p) => p.PK === via);
  const list = q
    ? proxies.filter(
        (p) =>
          p.city.toLowerCase().includes(q.toLowerCase()) ||
          p.country_name.toLowerCase().includes(q.toLowerCase()) ||
          p.PK.toLowerCase().includes(q.toLowerCase())
      )
    : proxies;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{service.name}</h4>
            <p className="text-xs text-slate-400 capitalize">{service.category} · choose an action</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1">
            <X size={18} />
          </button>
        </div>

        {picking ? (
          <div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search locations…"
              className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent text-sm"
            />
            {list.map((p) => (
              <button
                key={p.PK}
                onClick={() => { setVia(p.PK); setPicking(false); setQ(''); }}
                className="w-full text-left px-3 py-2.5 text-sm border-b border-slate-100 dark:border-slate-700/40"
              >
                {p.city}, {p.country_name} <span className="text-slate-400">({p.PK})</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {ACTIONS.map((a) => (
              <div key={a.key}>
                <button
                  onClick={() => (a.key === 'redirect' ? onChoose('redirect', via) : onChoose(a.key))}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl font-semibold mb-2 ${a.cls}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {a.label}
                </button>
                {a.key === 'redirect' && (
                  <button
                    onClick={() => setPicking(true)}
                    className="ml-8 mb-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 rounded-lg"
                  >
                    📍 {chosen ? `${chosen.city} (${chosen.PK})` : 'Pick location'} · change ›
                  </button>
                )}
              </div>
            ))}
            {service.action && (
              <button onClick={() => onChoose('off')} className="w-full text-center text-sm text-slate-400 pt-2">
                Remove / turn off
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
