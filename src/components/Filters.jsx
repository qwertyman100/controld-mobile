import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, toArray } from '../api/controld';

function normaliseFilter(f) {
  return {
    id: f.PK ?? f.pk ?? f.id ?? f.filter,
    name: f.name ?? f.title ?? `Filter ${f.PK ?? f.pk ?? f.id}`,
    description: f.description ?? f.desc ?? '',
    status: f.status ?? 0,
    category: f.category ?? f.type ?? 'Other',
    _raw: f,
  };
}

function groupByCategory(filters) {
  const map = {};
  filters.forEach((f) => {
    const cat = f.category || 'Other';
    (map[cat] ??= []).push(f);
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

// ── A single filter row with a toggle switch ──────────────────────────────
function FilterRow({ filter, onToggle, toggling }) {
  const enabled = filter.status === 1;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">
          {filter.name}
        </p>
        {filter.description ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-2">
            {filter.description}
          </p>
        ) : null}
      </div>

      {/* Toggle */}
      <button
        onClick={() => onToggle(filter)}
        disabled={toggling}
        aria-label={enabled ? 'Disable filter' : 'Enable filter'}
        className={`shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 ${
          enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
        } ${toggling ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? 'translate-x-[24px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ── Collapsible category section ──────────────────────────────────────────
function FilterCategory({ name, filters, onToggle, togglingId }) {
  const [collapsed, setCollapsed] = useState(false);
  const enabledCount = filters.filter((f) => f.status === 1).length;

  return (
    <div className="mb-3">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex-1 text-left">
          {name}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {enabledCount}/{filters.length} on
        </span>
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-slate-800/40 border-x border-b border-slate-200 dark:border-slate-700/50 rounded-b-xl overflow-hidden">
          {filters.map((f) => (
            <FilterRow
              key={f.id}
              filter={f}
              onToggle={onToggle}
              toggling={togglingId === f.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function FiltersSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Filters({ profile }) {
  const { token } = useAuth();
  const toast = useToast();

  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  const [native, setNative] = useState([]);
  const [external, setExternal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [tab, setTab] = useState('native'); // 'native' | 'external'

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [nativeBody, extBody] = await Promise.all([
        api.getFilters(token, profileId),
        api.getExternalFilters(token, profileId).catch(() => []),
      ]);
      setNative(toArray(nativeBody, 'filters').map(normaliseFilter));
      setExternal(toArray(extBody, 'filters', 'external_filters').map(normaliseFilter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, profileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(filter) {
    const newStatus = filter.status === 1 ? 0 : 1;
    setTogglingId(filter.id);

    // Optimistic
    const updater = (prev) =>
      prev.map((f) => (f.id === filter.id ? { ...f, status: newStatus } : f));
    setNative(updater);
    setExternal(updater);

    try {
      await api.toggleFilter(token, profileId, filter.id, newStatus);
      toast(`${filter.name} ${newStatus === 1 ? 'enabled' : 'disabled'}`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      // Rollback
      const rollback = (prev) =>
        prev.map((f) => (f.id === filter.id ? { ...f, status: filter.status } : f));
      setNative(rollback);
      setExternal(rollback);
      toast(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  }

  if (!profileId) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-slate-400 text-sm text-center">Select a profile first.</p>
      </div>
    );
  }

  const currentFilters = tab === 'native' ? native : external;
  const grouped = groupByCategory(currentFilters);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="shrink-0 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {['native', 'external'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors border-b-2 ${
              tab === t
                ? 'border-green-500 text-green-500'
                : 'border-transparent text-slate-400 dark:text-slate-500'
            }`}
          >
            {t === 'native' ? 'Native' : '3rd Party'}
            <span className="ml-2 text-xs opacity-70">
              ({(t === 'native' ? native : external).length})
            </span>
          </button>
        ))}
        <button
          onClick={load}
          className="px-4 text-slate-400 border-b-2 border-transparent"
          aria-label="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-area">
        {loading ? (
          <FiltersSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 text-green-500 font-medium text-sm"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No filters found.
          </div>
        ) : (
          <div className="p-4">
            {grouped.map(([category, filters]) => (
              <FilterCategory
                key={category}
                name={category}
                filters={filters}
                onToggle={handleToggle}
                togglingId={togglingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
