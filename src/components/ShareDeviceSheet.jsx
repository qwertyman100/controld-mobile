import { X, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../context/ToastContext';
import { buildShareUrl } from '../lib/shareDevice';

export default function ShareDeviceSheet({ onClose }) {
  const toast = useToast();
  const url = buildShareUrl(window.location.origin);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'ControlD Manager', text: 'Open ControlD Manager', url });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled — ignore
      toast('Could not share', 'error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add another device</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Scan on the new phone to open the app, then follow the prompts to sign in. No token or account data is shared here.
        </p>

        {/* QR on a white plate so it scans in dark mode too */}
        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <QRCodeSVG value={url} size={200} />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 break-all mb-4">{url}</p>

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm py-3 rounded-xl"
          >
            <Copy size={16} /> Copy link
          </button>
          {canShare && (
            <button
              onClick={share}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold text-sm py-3 rounded-xl"
            >
              <Share2 size={16} /> Share…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
