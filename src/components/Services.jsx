import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, toArray } from '../api/controld';
import { mergeServiceState, filterServices, buildServicePayload } from '../lib/services';
import { sanitizeSearchQuery } from '../lib/inputPolicy';
import ServiceActionSheet from './ServiceActionSheet';

const PILL = {
  block: 'bg-red-100 text-red-700',
  bypass: 'bg-green-100 text-green-700',
  redirect: 'bg-blue-100 text-blue-700',
};

// ── A single service row ───────────────────────────────────────────────────
// Hoisted to module scope (mirrors FilterRow in Filters.jsx) so it doesn't
// get redefined - and thus remounted - on every Services() render. PILL is
// already a module-level constant, so Row can close over it directly without
// needing it threaded through as a prop.
function Row({ service, onTap }) {
  return (
    <button
      onClick={() => onTap(service)}
      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/40 text-left"
    >
      <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{service.name}</span>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${service.action ? PILL[service.action] : 'bg-slate-200 text-slate-400'}`}>
        {service.action ? service.action[0].toUpperCase() + service.action.slice(1) : 'Set'} ›
      </span>
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
// Shared by the initial catalog load AND the first-search full-catalog sweep,
// so search never flashes an empty "no results" state while the background
// fetch is still running (see searchLoading below).
function ServicesSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
    </div>
  );
}

export default function Services({ profile }) {
  const { token } = useAuth();
  const toast = useToast();
  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  const [categories, setCategories] = useState([]);        // {PK,name,count}
  const [configured, setConfigured] = useState([]);        // per-profile set services
  const [proxies, setProxies] = useState([]);
  const [catCache, setCatCache] = useState({});            // { [catPK]: Service[] }
  const [openCats, setOpenCats] = useState({});
  const [query, setQuery] = useState('');
  const [allLoaded, setAllLoaded] = useState(false);       // full catalog cached (for search)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null);                // service being edited

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [catsBody, cfgBody, proxBody] = await Promise.all([
        api.getServiceCategories(token),
        api.getServices(token, profileId),
        api.getProxies(token).catch(() => []),
      ]);
      setCategories(toArray(catsBody, 'categories'));
      setConfigured(toArray(cfgBody, 'services'));
      setProxies(toArray(proxBody, 'proxies'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, profileId]);

  useEffect(() => { load(); }, [load]);

  const loadCategory = useCallback(async (catPK) => {
    if (catCache[catPK]) return;
    try {
      const body = await api.getServiceCategory(token, catPK);
      setCatCache((c) => ({ ...c, [catPK]: toArray(body, 'services') }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [token, catCache, toast]);

  async function toggleCat(catPK) {
    const willOpen = !openCats[catPK];
    setOpenCats((o) => ({ ...o, [catPK]: willOpen }));
    if (willOpen) await loadCategory(catPK);
  }

  // Guards the first-search full-catalog sweep below against re-entrancy.
  // `allLoaded` only flips true after the awaited Promise.all resolves, and
  // `query` (a dep of that effect) changes on every keystroke - so without a
  // *synchronous* flag, each keystroke typed while the sweep is still in
  // flight would fire off another full round of per-category fetches. A ref
  // (not state) is required here because it must be readable/settable
  // synchronously, before the first `await`, with no extra render in between.
  const searchSweepInFlight = useRef(false);

  // On first search, fetch every not-yet-cached category once and cache it.
  useEffect(() => {
    if (!query || allLoaded || !categories.length) return;
    if (searchSweepInFlight.current) return; // a sweep is already running - bail
    searchSweepInFlight.current = true;
    (async () => {
      try {
        const toFetch = categories.filter((c) => !catCache[c.PK]);
        const entries = await Promise.all(
          toFetch.map(async (c) => {
            const body = await api.getServiceCategory(token, c.PK).catch(() => ({}));
            return [c.PK, toArray(body, 'services')];
          })
        );
        setCatCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setAllLoaded(true);
      } finally {
        searchSweepInFlight.current = false;
      }
    })();
  }, [query, allLoaded, categories, catCache, token]);

  // Derived (not stateful) so it's correct from the very first render that
  // has `query` set - a `useState` toggled inside the effect above would lag
  // one render behind (state set only after the effect runs post-paint),
  // reopening exactly the false-"No apps match" flash this is meant to
  // prevent. `allLoaded` starts false and only flips true once the sweep
  // above fully completes, so this is true for the whole in-flight window.
  const searchLoading = Boolean(query) && !allLoaded;

  const withState = useCallback(
    (list) => mergeServiceState(list, configured),
    [configured]
  );

  const searchResults = useMemo(() => {
    if (!query) return null;
    // A service can appear in more than one category (e.g. a redirect target
    // listed under both "Streaming" and "Social"); de-dupe by PK so it can't
    // render twice / collide on the React `key`.
    const byPk = new Map();
    for (const s of Object.values(catCache).flat()) {
      if (!byPk.has(s.PK)) byPk.set(s.PK, s);
    }
    return withState(filterServices([...byPk.values()], query));
  }, [query, catCache, withState]);

  async function choose(service, action, via) {
    setSheet(null);
    const prev = configured;
    // optimistic: reflect the change locally
    const next = configured.filter((c) => c.PK !== service.PK);
    const payload = action === 'off' ? null : buildServicePayload(action, via);
    if (payload) next.push({ PK: service.PK, do: payload.do, status: 1, via: via ?? null });
    setConfigured(next);
    try {
      if (action === 'off') {
        // "Remove" fully DELETEs the record rather than disabling it (status:0),
        // so the profile stays clean instead of accruing inert placeholder entries.
        await api.deleteService(token, profileId, service.PK);
        toast(`${service.name} removed`, 'success');
      } else {
        await api.updateService(token, profileId, service.PK, payload);
        toast(`${service.name} → ${action}`, 'success');
      }
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setConfigured(prev); // rollback
      toast(err.message, 'error');
    }
  }

  if (!profileId) {
    return <div className="flex items-center justify-center p-8"><p className="text-slate-400 text-sm">Select a profile first.</p></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 flex gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(sanitizeSearchQuery(e.target.value))}
            maxLength={128}
            placeholder="Search apps…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={load} aria-label="Refresh" className="text-slate-400 px-2"><RefreshCw size={15} /></button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area">
        {loading ? (
          <ServicesSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-500">{error}</p>
            <button onClick={load} className="flex items-center gap-2 text-green-500 font-medium text-sm"><RefreshCw size={14} /> Retry</button>
          </div>
        ) : query ? (
          <div>
            {searchLoading ? (
              // First full-catalog sweep still running: show the same skeleton
              // as the initial load instead of a premature "No apps match".
              <ServicesSkeleton />
            ) : searchResults && searchResults.length ? (
              searchResults.map((s) => <Row key={s.PK} service={s} onTap={setSheet} />)
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">No apps match "{query}".</div>
            )}
          </div>
        ) : (
          <div className="p-2">
            {categories.map((c) => (
              <div key={c.PK} className="mb-2">
                <button onClick={() => toggleCat(c.PK)} className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                  {openCats[c.PK] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex-1 text-left">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.count}</span>
                </button>
                {openCats[c.PK] && (
                  <div className="bg-white dark:bg-slate-800/40 rounded-b-xl overflow-hidden">
                    {(withState(catCache[c.PK] || [])).map((s) => <Row key={s.PK} service={s} onTap={setSheet} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {sheet && (
        <ServiceActionSheet
          service={sheet}
          proxies={proxies}
          onChoose={(action, via) => choose(sheet, action, via)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
