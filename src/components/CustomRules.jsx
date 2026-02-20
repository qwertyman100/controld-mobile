import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, toArray, RULE_ACTION, extractDomain } from '../api/controld';

// Map numeric "do" value → display label + colour
// API: 0=BLOCK, 1=BYPASS, 2=SPOOF, 3=REDIRECT
const ACTION_META = {
  [RULE_ACTION.BLOCK]:   { label: 'Block',    color: 'text-red-500',   bg: 'bg-red-500/10 border-red-500/25'    },
  [RULE_ACTION.BYPASS]:  { label: 'Bypass',   color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/25' },
  [RULE_ACTION.REDIRECT]:{ label: 'Redirect', color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/25'  },
};

// Normalise a rule object to a consistent shape regardless of API quirks
// API shape: { PK, hostname, do, status, group (int), order, via }
function normaliseRule(r) {
  return {
    hostname: r.hostname ?? r.PK ?? r.pk ?? '',
    do: r.do ?? RULE_ACTION.BYPASS,
    status: r.status ?? 1,
    group: r.group ?? null,  // integer group PK, null = ungrouped
    via: r.via ?? null,
    _raw: r,
  };
}

export default function CustomRules({ profile, clipboardDomain, onClipboardAdd }) {
  const { token } = useAuth();
  const toast = useToast();

  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  // ── Data state ──
  const [rules, setRules] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Quick-add state ──
  const [domain, setDomain] = useState('');
  const [action, setAction] = useState(RULE_ACTION.BYPASS); // default: bypass
  const [adding, setAdding] = useState(false);

  // ── Proxy state (for redirect rules) ──
  const [proxies, setProxies] = useState([]);
  const [proxiesError, setProxiesError] = useState(null);
  const [via, setVia] = useState('');

  // ── UI state ──
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [deletingHostname, setDeletingHostname] = useState(null);

  const inputRef = useRef(null);

  // ── Load rules + groups ──
  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [rulesBody, groupsBody] = await Promise.all([
        api.getRules(token, profileId),
        api.getGroups(token, profileId).catch(() => []),
      ]);
      setRules(toArray(rulesBody, 'rules', 'custom_rules').map(normaliseRule));
      setGroups(toArray(groupsBody, 'groups'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, profileId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch proxies once on mount
  useEffect(() => {
    api.getProxies(token)
      .then((body) => {
        const list = toArray(body, 'proxies');
        setProxies(list);
        if (list.length > 0) {
          const first = list[0];
          setVia(first.PK ?? first.pk ?? first.id ?? first.name ?? '');
        }
      })
      .catch((err) => {
        setProxiesError(err.message);
      });
  }, [token]);

  // ── Add rule (used by quick-add AND clipboard banner) ──
  const addRule = useCallback(
    async (hostname, doAction, viaProxy) => {
      const cleaned = extractDomain(hostname) ?? hostname.trim().toLowerCase();
      if (!cleaned) return;

      setAdding(true);
      try {
        await api.createRule(token, profileId, {
          'hostnames[]': cleaned,
          do: doAction,
          status: 1,
          ...(doAction === RULE_ACTION.REDIRECT && viaProxy ? { via: viaProxy } : {}),
        });
        const meta = ACTION_META[doAction] ?? ACTION_META[RULE_ACTION.BYPASS];
        toast(`${meta.label}: ${cleaned}`, 'success');
        if (navigator.vibrate) navigator.vibrate(30);
        setDomain('');
        // Optimistically prepend
        setRules((prev) => [
          { hostname: cleaned, do: doAction, status: 1, group: null, via: doAction === RULE_ACTION.REDIRECT ? (viaProxy ?? null) : null },
          ...prev.filter((r) => r.hostname !== cleaned),
        ]);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setAdding(false);
      }
    },
    [token, profileId, toast]  // via is passed as arg, not captured
  );

  // ── Clipboard handler (called from App via prop) ──
  // onClipboardAdd(action) → parent calls back with the domain
  // We expose addRule so App can wire it up
  useEffect(() => {
    if (onClipboardAdd) {
      onClipboardAdd.current = (hostname, doAction) => addRule(hostname, doAction);
    }
  }, [addRule, onClipboardAdd]);

  // ── Delete rule ──
  async function deleteRule(hostname) {
    setDeletingHostname(hostname);
    try {
      await api.deleteRule(token, profileId, hostname);
      setRules((prev) => prev.filter((r) => r.hostname !== hostname));
      toast(`Removed ${hostname}`, 'success');
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeletingHostname(null);
    }
  }

  // ── Toggle rule on/off ──
  async function toggleRule(rule) {
    const newStatus = rule.status === 1 ? 0 : 1;
    // Optimistic update
    setRules((prev) =>
      prev.map((r) =>
        r.hostname === rule.hostname ? { ...r, status: newStatus } : r
      )
    );
    try {
      await api.updateRule(token, profileId, {
        hostname: rule.hostname,
        do: rule.do,
        status: newStatus,
      });
    } catch (err) {
      // Rollback
      setRules((prev) =>
        prev.map((r) =>
          r.hostname === rule.hostname ? { ...r, status: rule.status } : r
        )
      );
      toast(err.message, 'error');
    }
  }

  // ── Domain input: auto-clean pasted URLs ──
  function handleDomainInput(e) {
    const raw = e.target.value;
    // If user pastes something that looks like a URL, extract domain
    if (raw.includes('://') || raw.includes('/')) {
      const cleaned = extractDomain(raw);
      if (cleaned) {
        setDomain(cleaned);
        return;
      }
    }
    setDomain(raw);
  }

  // ── Filter + group rules ──
  const filtered = rules.filter(
    (r) =>
      !search || r.hostname.toLowerCase().includes(search.toLowerCase())
  );

  // Partition into ungrouped and per-group
  const ungrouped = filtered.filter((r) => !r.group);
  const byGroup = {};
  filtered.forEach((r) => {
    if (r.group) {
      (byGroup[r.group] ??= []).push(r);
    }
  });

  if (!profileId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Select a profile first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Quick-Add Bar — always visible at top ── */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addRule(domain, action, via);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="url"
              value={domain}
              onChange={handleDomainInput}
              placeholder="domain.com or paste URL"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 min-w-0"
            />
            <button
              type="submit"
              disabled={!domain.trim() || adding || (action === RULE_ACTION.REDIRECT && !via)}
              className="shrink-0 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl px-4 py-3 font-semibold text-sm flex items-center gap-1.5 transition-colors min-w-[76px] justify-center"
            >
              {adding ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Plus size={16} />
                  Add
                </>
              )}
            </button>
          </div>

          {/* Action selector — Block / Bypass / Redirect */}
          <div className="flex gap-2">
            {[RULE_ACTION.BYPASS, RULE_ACTION.BLOCK, RULE_ACTION.REDIRECT].map((val) => {
              const meta = ACTION_META[val];
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAction(val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    action === val
                      ? meta.bg + ' ' + meta.color + ' border-current'
                      : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Proxy selector — only shown for Redirect */}
          {action === RULE_ACTION.REDIRECT && (
            proxiesError ? (
              <p className="text-xs text-red-400 px-1">
                Failed to load proxies: {proxiesError}
              </p>
            ) : (
              <select
                value={via}
                onChange={(e) => setVia(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {proxies.length === 0 && (
                  <option value="">Loading proxies…</option>
                )}
                {proxies.map((p) => {
                  const id = p.PK ?? p.pk ?? p.id ?? p.name ?? '';
                  const label = p.name ?? p.city ?? p.label ?? id;
                  const country = p.country ?? p.country_code ?? '';
                  return (
                    <option key={id} value={id}>
                      {country ? `${country} — ${label}` : label}
                    </option>
                  );
                })}
              </select>
            )
          )}
        </form>
      </div>

      {/* ── Search bar ── */}
      <div className="shrink-0 px-3 py-2 bg-slate-50 dark:bg-slate-950">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${rules.length} rules…`}
            className="w-full bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/50 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* ── Rule list ── */}
      <div className="flex-1 overflow-y-auto scroll-area">
        {loading ? (
          <RulesSkeleton />
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
        ) : (
          <div className="pb-4">
            {/* Header with count + refresh */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
                {search ? ' matched' : ''}
              </span>
              <button
                onClick={load}
                className="text-slate-400 p-1"
                aria-label="Refresh"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Ungrouped rules */}
            {ungrouped.length > 0 && (
              <RuleGroup
                rules={ungrouped}
                deletingHostname={deletingHostname}
                onDelete={deleteRule}
                onToggle={toggleRule}
              />
            )}

            {/* Grouped rules */}
            {groups
              .filter((g) => byGroup[g.PK ?? g.pk ?? g.id]?.length)
              .map((group) => {
                // API shape: { PK: integer, group: string (name), action, count }
                const gid = group.PK ?? group.pk ?? group.id;
                const gname = group.group ?? group.name ?? `Group ${gid}`;
                const collapsed = collapsedGroups[gid];
                const groupRules = byGroup[gid] ?? [];

                return (
                  <div key={gid} className="mb-1">
                    <button
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [gid]: !prev[gid],
                        }))
                      }
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
                    >
                      {collapsed ? (
                        <ChevronRight size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {gname}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                        {groupRules.length}
                      </span>
                    </button>
                    {!collapsed && (
                      <RuleGroup
                        rules={groupRules}
                        deletingHostname={deletingHostname}
                        onDelete={deleteRule}
                        onToggle={toggleRule}
                      />
                    )}
                  </div>
                );
              })}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                {search ? 'No rules match your search.' : 'No rules yet. Add one above.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rule list group ────────────────────────────────────────────────────────
function RuleGroup({ rules, deletingHostname, onDelete, onToggle }) {
  return (
    <div className="px-3 flex flex-col gap-1">
      {rules.map((rule) => (
        <RuleRow
          key={rule.hostname}
          rule={rule}
          deleting={deletingHostname === rule.hostname}
          onDelete={() => onDelete(rule.hostname)}
          onToggle={() => onToggle(rule)}
        />
      ))}
    </div>
  );
}

// ── Single rule row ────────────────────────────────────────────────────────
function RuleRow({ rule, deleting, onDelete, onToggle }) {
  const meta = ACTION_META[rule.do] ?? ACTION_META[RULE_ACTION.BYPASS];
  const disabled = rule.status === 0;

  return (
    <div
      className={`rule-row flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3.5 py-3 ${
        deleting ? 'deleting' : ''
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Action badge */}
      <span
        className={`text-[10px] font-bold uppercase shrink-0 px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}
      >
        {meta.label}
      </span>

      {/* Hostname + via */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {rule.hostname}
        </span>
        {rule.do === RULE_ACTION.REDIRECT && rule.via && (
          <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">
            via {rule.via}
          </span>
        )}
      </span>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="shrink-0 text-slate-400 dark:text-slate-500 p-1"
        aria-label={rule.status === 1 ? 'Disable rule' : 'Enable rule'}
      >
        {rule.status === 1 ? (
          <ToggleRight size={22} className="text-green-500" />
        ) : (
          <ToggleLeft size={22} />
        )}
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-500 p-1 transition-colors"
        aria-label={`Delete rule for ${rule.hostname}`}
      >
        {deleting ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <Trash2 size={17} />
        )}
      </button>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function RulesSkeleton() {
  return (
    <div className="px-3 pt-2 flex flex-col gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-14 rounded-xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
