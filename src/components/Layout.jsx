import { Sun, Moon, ChevronLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import BottomNav from './BottomNav';

/**
 * App shell: header + content area + bottom navigation.
 * Children fill the scrollable middle section.
 */
export default function Layout({
  title,
  subtitle,
  showBack,
  onBack,
  page,
  onNavigate,
  children,
  banner,         // ClipboardBanner node
}) {
  const { isDark, toggle } = useTheme();

  return (
    <div className="flex flex-col h-dvh bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* ── Header ── */}
      <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-safe">
        <div className="flex items-center gap-3 h-14">
          {/* Back button or logo */}
          {showBack ? (
            <button
              onClick={onBack}
              className="text-slate-500 dark:text-slate-400 -ml-1 p-2 rounded-lg"
              aria-label="Back"
            >
              <ChevronLeft size={22} />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
          )}

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-base leading-tight truncate">
              {title || 'ControlD'}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right controls — Settings lives in the bottom nav, so no gear here
              (a header gear reads as a drill-in with a back button, but the exit
              is the nav; removing it kills that dead-end confusion). */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Clipboard banner (slides in below header) ── */}
      {banner}

      {/* ── Page content ── */}
      <main className="flex-1 overflow-y-auto scroll-area">
        {children}
      </main>

      {/* ── Bottom navigation ── */}
      <BottomNav current={page} onNavigate={onNavigate} />
    </div>
  );
}
