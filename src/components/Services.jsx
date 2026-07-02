import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, toArray } from '../api/controld';
import { mergeServiceState, filterServices, buildServicePayload } from '../lib/services';
import ServiceActionSheet from './ServiceActionSheet';

const PILL = {
  block: 'bg-red-100 text-red-700',
  bypass: 'bg-green-100 text-green-700',
  redirect: 'bg-blue-100 text-blue-700',
};

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

  // On first search, fetch every category once and cache it.
  useEffect(() => {
    if (!query || allLoaded || !categories.length) return;
    (async () => {
      const entries = await Promise.all(
        categories.map(async (c) => {
          if (catCache[c.PK]) return [c.PK, catCache[c.PK]];
          const body = await api.getServiceCategory(token, c.PK).catch(() => ({}));
          return [c.PK, toArray(body, 'services')];
        })
      );
      setCatCache((prev) => ({ ...Object.fromEntries(entries), ...prev }));
      setAllLoaded(true);
    })();
  }, [query, allLoaded, categories, catCache, token]);

  const withState = useCallback(
    (list) => mergeServiceState(list, configured),
    [configured]
  );

  const searchResults = useMemo(() => {
    if (!query) return null;
    const all = Object.values(catCache).flat();
    return withState(filterServices(all, query));
  }, [query, catCache, withState]);

  async function choose(service, action, via) {
    setSheet(null);
    const prev = configured;
    // optimistic: reflect the change locally
    const payload = buildServicePayload(action, via);
    const next = configured.filter((c) => c.PK !== service.PK);
    if (action !== 'off') next.push({ PK: service.PK, do: payload.do, status: 1, via: via ?? null });
    setConfigured(next);
    try {
      await api.updateService(token, profileId, service.PK, payload);
      toast(`${service.name} → ${action}`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setConfigured(prev); // rollback
      toast(err.message, 'error');
    }
  }

  if (!profileId) {
    return <div className="flex items-center justify-center p-8"><p className="text-slate-400 text-sm">Select a profile first.</p></div>;
  }

  function Row({ s }) {
    return (
      <button
        onClick={() => setSheet(s)}
        className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/40 text-left"
      >
        <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{s.name}</span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.action ? PILL[s.action] : 'bg-slate-200 text-slate-400'}`}>
          {s.action ? s.action[0].toUpperCase() + s.action.slice(1) : 'Set'} ›
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 flex gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={load} aria-label="Refresh" className="text-slate-400 px-2"><RefreshCw size={15} /></button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl bg-slate-200 dark:bg-slate-800" />)}</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-500">{error}</p>
            <button onClick={load} className="flex items-center gap-2 text-green-500 font-medium text-sm"><RefreshCw size={14} /> Retry</button>
          </div>
        ) : query ? (
          <div>
            {searchResults && searchResults.length ? searchResults.map((s) => <Row key={s.PK} s={s} />)
              : <div className="text-center py-12 text-slate-400 text-sm">No apps match "{query}".</div>}
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
                    {(withState(catCache[c.PK] || [])).map((s) => <Row key={s.PK} s={s} />)}
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
