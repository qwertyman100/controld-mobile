// src/components/FilterLevelSheet.jsx
import { X } from 'lucide-react';
import { getFilterLevels, AI_STRENGTHS, parseModeDescriptions } from '../lib/filterLevels';

// Colour by mode position (Off grey, then green→amber→red by intensity).
function dotClass(title) {
  if (title === 'Off') return 'bg-slate-400';
  if (title === 'Strict') return 'bg-red-500';
  if (title === 'Balanced') return 'bg-amber-500';
  return 'bg-green-500'; // Relaxed and any other first-tier title (e.g. "Last Week")
}

export default function FilterLevelSheet({ filter, currentOverride, aiOverride, onChoose, onClose }) {
  const { options, currentTitle: rawCurrent, isCumulative, aiValue: rawAi } = getFilterLevels(filter);
  // Reflect the optimistic override (what the user just set) so reopening the
  // sheet shows the correct current level/strength, not the stale raw data.
  const currentTitle = currentOverride ?? rawCurrent;
  const aiValue = aiOverride ?? rawAi;
  // Per-mode "what it blocks" text, parsed from the API's `additional` HTML to
  // plain text (no raw-HTML render). Off has no entry — that's fine.
  const descriptions = parseModeDescriptions(filter.additional);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{String(filter.name ?? '')}</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        {filter.description ? (
          <p className="text-xs text-slate-400 mb-3">{String(filter.description)}</p>
        ) : null}

        {options.map((title) => {
          const selected = title === currentTitle;
          return (
            <div key={title}>
              <button
                onClick={() => onChoose(title, isCumulative && title === 'Strict' ? (aiValue ?? 0.9) : undefined)}
                className={`w-full text-left px-4 py-3 rounded-xl mb-2 ${
                  selected ? 'ring-2 ring-green-500 bg-slate-100 dark:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-700/30'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotClass(title)}`} />
                  {title}
                  {selected ? <span className="ml-auto text-xs text-green-500">current</span> : null}
                </span>
                {descriptions[title] ? (
                  <span className="block mt-1 ml-[18px] text-xs font-normal text-slate-500 dark:text-slate-400 leading-snug">
                    {descriptions[title]}
                  </span>
                ) : null}
              </button>

              {isCumulative && title === 'Strict' && (
                <div className="ml-6 mb-2 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400 mb-1.5">AI strength</div>
                  <div className="flex gap-1.5">
                    {AI_STRENGTHS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => onChoose('Strict', s.value)}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded ${
                          aiValue === s.value && currentTitle === 'Strict'
                            ? 'bg-red-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
