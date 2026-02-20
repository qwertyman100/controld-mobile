import { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, toArray } from '../api/controld';

/**
 * Home screen: lists all profiles and lets the user select one.
 * Remembers the last-used profile in localStorage.
 */
export default function ProfileList({ activeProfile, onSelectProfile }) {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const body = await api.getProfiles(token);
      // Body might be { profiles: [...] } or [...] directly
      const list = toArray(body, 'profiles');
      setProfiles(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <ProfileSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button
          onClick={load}
          className="flex items-center gap-2 text-green-500 font-medium text-sm"
        >
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          No profiles found.
        </p>
        <button
          onClick={load}
          className="flex items-center gap-2 text-green-500 font-medium text-sm"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Profiles
        </h2>
        <button
          onClick={load}
          className="text-slate-400 p-1.5"
          aria-label="Refresh profiles"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {profiles.map((profile) => {
          const id = profile.PK ?? profile.pk ?? profile.id;
          const name = profile.name ?? profile.label ?? `Profile ${id}`;
          const isActive = activeProfile?.PK === id || activeProfile?.pk === id || activeProfile?.id === id;

          return (
            <button
              key={id}
              onClick={() => onSelectProfile(profile)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors ${
                isActive
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50'
              }`}
            >
              {/* Profile icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${
                  isActive
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${isActive ? 'text-green-500' : ''}`}>
                  {name}
                </p>
                {profile.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {profile.description}
                  </p>
                )}
              </div>

              {isActive && (
                <span className="text-xs font-medium text-green-500 shrink-0">
                  Active
                </span>
              )}
              <ChevronRight
                size={18}
                className="text-slate-400 dark:text-slate-500 shrink-0"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton h-[72px] rounded-2xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
