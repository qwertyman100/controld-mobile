import { LayoutGrid, List, Shield, Blocks, Settings } from 'lucide-react';

const TABS = [
  { id: 'profiles', label: 'Profiles', Icon: LayoutGrid },
  { id: 'rules',    label: 'Rules',    Icon: List },
  { id: 'filters',  label: 'Filters',  Icon: Shield },
  { id: 'services', label: 'Services', Icon: Blocks },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function BottomNav({ current, onNavigate }) {
  return (
    <nav className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="flex">
        {TABS.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors ${
                active
                  ? 'text-green-500'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
              aria-label={label}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              <span className={`text-[10px] font-medium ${active ? 'text-green-500' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
