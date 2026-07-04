import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { api, toArray } from '../api/controld';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { normaliseDevice, deviceChainLabel, deviceIcon } from '../lib/devices';
import DeviceEditSheet from './DeviceEditSheet';

function pName(profiles, id) {
  const p = profiles.find((x) => String(x.PK ?? x.pk ?? x.id) === String(id));
  return p ? (p.name ?? String(id)) : null;
}

export default function DeviceList() {
  const { token } = useAuth();
  const toast = useToast();
  const [devices, setDevices] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [devBody, profBody] = await Promise.all([
        api.getDevices(token),
        api.getProfiles(token).catch(() => []),
      ]);
      setDevices(toArray(devBody, 'devices').map(normaliseDevice));
      setProfiles(toArray(profBody, 'profiles'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async (payload) => {
    const dev = editing;
    setEditing(null);
    if (!dev) return;
    const prev = devices;
    // Optimistic: reflect the new primary/chain (names looked up from profiles).
    setDevices((ds) => ds.map((d) => d.id === dev.id ? {
      ...d,
      profileId: payload.profile_id,
      profileName: pName(profiles, payload.profile_id) ?? d.profileName,
      profile2Id: payload.profile_id2 === '-1' ? null : payload.profile_id2,
      profile2Name: payload.profile_id2 === '-1' ? null : pName(profiles, payload.profile_id2),
    } : d));
    try {
      await api.updateDevice(token, dev.id, payload);
      toast(`Updated ${dev.name}`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setDevices(prev); // rollback
      toast(err.message, 'error');
    }
  }, [editing, devices, profiles, token, toast]);

  if (loading) {
    return (
      <div className="p-3 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[64px] rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button onClick={load} className="flex items-center gap-2 text-green-500 font-medium text-sm">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      {devices.map((d) => {
        const Icon = deviceIcon(d.icon);
        return (
          <button
            key={d.id}
            onClick={() => setEditing(d)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl text-left bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${d.online ? 'bg-green-500' : 'bg-slate-400'}`} />
                <p className="font-semibold truncate">{d.name}</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{deviceChainLabel(d)}</p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">{d.clients} client{d.clients === 1 ? '' : 's'}</span>
            <ChevronRight size={16} className="text-slate-400 shrink-0" />
          </button>
        );
      })}
      {editing && (
        <DeviceEditSheet device={editing} profiles={profiles} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
