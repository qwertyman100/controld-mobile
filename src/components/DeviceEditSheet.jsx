import { useState } from 'react';
import { X } from 'lucide-react';
import { buildDeviceProfilePayload } from '../lib/devices';

export default function DeviceEditSheet({ device, profiles = [], onSave, onClose }) {
  const [profileId, setProfileId] = useState(device.profileId ?? '');
  const [profile2Id, setProfile2Id] = useState(device.profile2Id ?? '');

  function handleSave() {
    onSave(buildDeviceProfilePayload({ profileId, profile2Id: profile2Id || null }));
  }

  const r = device.resolvers || {};
  const selectCls =
    'mt-1 mb-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{device.name}</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          {device.online ? 'Online' : 'Offline'} · {device.clients} client{device.clients === 1 ? '' : 's'} · {device.ipCount} IPs
        </p>

        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Primary profile</label>
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={selectCls}>
          {profiles.map((p) => {
            const id = p.PK ?? p.pk ?? p.id;
            return <option key={id} value={id}>{p.name ?? id}</option>;
          })}
        </select>

        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Chained profile</label>
        <select value={profile2Id} onChange={(e) => setProfile2Id(e.target.value)} className={selectCls}>
          <option value="">None</option>
          {profiles.map((p) => {
            const id = p.PK ?? p.pk ?? p.id;
            return <option key={id} value={id}>{p.name ?? id}</option>;
          })}
        </select>

        <button onClick={handleSave} className="w-full bg-green-500 text-white font-semibold text-sm py-3 rounded-xl mb-4">
          Save
        </button>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Connection</div>
          <dl className="space-y-2 text-xs">
            <div><dt className="text-slate-400">DoH</dt><dd className="text-slate-700 dark:text-slate-200 break-all">{r.doh}</dd></div>
            <div><dt className="text-slate-400">DoT</dt><dd className="text-slate-700 dark:text-slate-200 break-all">{r.dot}</dd></div>
            {Array.isArray(r.v6) && r.v6.length > 0 && (
              <div><dt className="text-slate-400">IPv6</dt><dd className="text-slate-700 dark:text-slate-200 break-all">{r.v6.join(', ')}</dd></div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
