import { useState } from 'react';
import { Sun, Moon, LogOut, User, Info, QrCode, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ShareDeviceSheet from './ShareDeviceSheet';

// Injected by Vite (see vite.config define). Guarded so it never throws if absent.
const BUILD_STAMP = typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev';

export default function Settings() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [shareOpen, setShareOpen] = useState(false);

  // GET /users returns: { last_active, proxy_access, email_status }
  // No email/username in the response — show connected status instead
  const email = user?.email ?? user?.user?.email ?? '';
  const username = user?.username ?? user?.user?.username ?? '';
  const displayName = username || email || 'Connected';
  const lastActive = user?.last_active ?? user?.user?.last_active;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Account card */}
      <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Account
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <User size={20} className="text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
              {displayName}
            </p>
            {lastActive ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Last active:{' '}
                {new Date(lastActive * 1000).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-xs text-green-500 mt-0.5">API token valid</p>
            )}
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Appearance
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            {isDark ? (
              <Moon size={20} className="text-slate-300" />
            ) : (
              <Sun size={20} className="text-slate-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
              {isDark ? 'Dark mode' : 'Light mode'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Tap to switch theme
            </p>
          </div>
          {/* Toggle switch */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className={`shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 ${
              isDark ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                isDark ? 'translate-x-[24px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Clipboard note */}
      <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Clipboard Detection
          </p>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            When you switch to this app, it checks your clipboard for a URL.
            If found, a banner appears so you can add a rule in one tap.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-2 leading-relaxed">
            If the browser prompts for clipboard permission, tap{' '}
            <strong className="text-slate-700 dark:text-slate-300">Allow</strong> to
            enable this feature.
          </p>
        </div>
      </section>

      {/* About */}
      <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            About
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Info size={20} className="text-slate-500 dark:text-slate-300" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
              ControlD Manager
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Phase 1 — Personal PWA
            </p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">
              Build {BUILD_STAMP}
            </p>
          </div>
        </div>
      </section>

      {/* Add another device */}
      <button
        onClick={() => setShareOpen(true)}
        className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 px-4 py-4 text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <QrCode size={20} className="text-slate-500 dark:text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-slate-800 dark:text-slate-200">Add another device</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Share the app with a QR code</p>
        </div>
        <ChevronRight size={18} className="text-slate-400 shrink-0" />
      </button>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 text-red-500 font-semibold rounded-2xl py-4 text-base active:bg-red-500/20 transition-colors"
      >
        <LogOut size={18} />
        Disconnect
      </button>

      {shareOpen && <ShareDeviceSheet onClose={() => setShareOpen(false)} />}
    </div>
  );
}
