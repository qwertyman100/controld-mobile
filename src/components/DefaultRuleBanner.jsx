import { useState, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, toArray } from '../api/controld';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_ACTIONS, normaliseDefaultAction } from '../lib/defaultRule';
import DefaultRuleSheet from './DefaultRuleSheet';

// `proxies` is passed in by CustomRules (which already loads it for the redirect
// add-bar) so we don't fire a second identical GET /proxies when the Rules screen
// opens. Defaults to [] so the banner still renders standalone.
export default function DefaultRuleBanner({ profile, proxies = [] }) {
  const { token } = useAuth();
  const toast = useToast();
  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  // Seed instantly from the selected profile's cached da (no flash), then
  // refresh from the server so the banner shows the authoritative default.
  const [da, setDa] = useState(() => normaliseDefaultAction(profile?.profile?.da));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token || !profileId) return;
    api.getProfiles(token)
      .then((body) => {
        const list = toArray(body, 'profiles');
        const found = list.find((p) => (p.PK ?? p.pk ?? p.id) === profileId);
        if (found) setDa(normaliseDefaultAction(found.profile?.da));
      })
      .catch(() => {}); // keep the seeded value on failure
  }, [token, profileId]);

  const handleSave = useCallback(async (payload) => {
    setOpen(false);
    const prev = da;
    setDa(normaliseDefaultAction(payload)); // optimistic
    try {
      await api.setDefaultRule(token, profileId, payload);
      toast('Default rule updated', 'success');
    } catch (err) {
      setDa(prev); // rollback
      toast(err.message, 'error');
    }
  }, [da, token, profileId, toast]);

  const meta = DEFAULT_ACTIONS.find((a) => a.do === da.do) ?? DEFAULT_ACTIONS[1];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">When nothing matches</div>
          <div className={`text-sm font-semibold mt-0.5 ${meta.color}`}>{meta.label}</div>
        </div>
        <span className="text-xs font-medium text-slate-400 shrink-0">Change</span>
        <ChevronRight size={16} className="text-slate-400 -ml-1" />
      </button>
      {open && (
        <DefaultRuleSheet da={da} proxies={proxies} onSave={handleSave} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
