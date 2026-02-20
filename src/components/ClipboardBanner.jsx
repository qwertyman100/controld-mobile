import { Shield, ShieldOff, X } from 'lucide-react';

/**
 * Slide-down banner shown when clipboard contains a recognizable domain.
 * Lets the user instantly add a bypass or block rule without typing.
 */
export default function ClipboardBanner({ domain, onBypass, onBlock, onDismiss }) {
  if (!domain) return null;

  return (
    <div className="slide-down bg-slate-800 dark:bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
      {/* Domain info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          Clipboard detected
        </p>
        <p className="text-white font-semibold text-sm truncate">{domain}</p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onBypass}
          className="flex items-center gap-1.5 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg px-3 py-2 text-sm font-medium active:bg-green-500/25"
        >
          <Shield size={14} />
          Bypass
        </button>
        <button
          onClick={onBlock}
          className="flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg px-3 py-2 text-sm font-medium active:bg-red-500/25"
        >
          <ShieldOff size={14} />
          Block
        </button>
        <button
          onClick={onDismiss}
          className="text-slate-500 hover:text-slate-300 p-1.5"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
