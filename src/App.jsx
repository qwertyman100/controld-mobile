import { useState, useRef, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useClipboard } from './hooks/useClipboard';
import { RULE_ACTION } from './api/controld';

import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';
import ClipboardBanner from './components/ClipboardBanner';
import ProfileList from './components/ProfileList';
import CustomRules from './components/CustomRules';
import Filters from './components/Filters';
import Settings from './components/Settings';
import { useToast } from './context/ToastContext';

// Persist last-used profile
function loadSavedProfile() {
  try {
    return JSON.parse(localStorage.getItem('cd_last_profile') ?? 'null');
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem('cd_last_profile', JSON.stringify(profile));
  } catch {}
}

// ── Loading splash ──────────────────────────────────────────────────────────
function Splash() {
  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-slate-500 text-sm">Connecting…</p>
    </div>
  );
}

// ── Root app ────────────────────────────────────────────────────────────────
export default function App() {
  const { token, loading } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState('profiles');
  const [activeProfile, setActiveProfile] = useState(loadSavedProfile);

  // Ref to CustomRules' addRule function — lets us trigger a rule add from
  // the clipboard banner without prop-drilling deeply
  const addRuleRef = useRef(null);

  const { clipboardDomain, dismiss, markAdded } = useClipboard();

  // Selecting a profile from the list
  const handleSelectProfile = useCallback((profile) => {
    setActiveProfile(profile);
    saveProfile(profile);
    setPage('rules');
  }, []);

  // Clipboard banner action
  const handleClipboardAction = useCallback(
    async (doAction) => {
      if (!activeProfile) {
        toast('Select a profile first', 'info');
        dismiss();
        return;
      }
      if (addRuleRef.current) {
        await addRuleRef.current(clipboardDomain, doAction);
        markAdded(clipboardDomain);
      }
    },
    [activeProfile, clipboardDomain, dismiss, markAdded, toast]
  );

  const profileName =
    activeProfile?.name ?? activeProfile?.label ?? null;

  const pageTitle = {
    profiles: 'Profiles',
    rules: profileName ?? 'Rules',
    filters: 'Filters',
    settings: 'Settings',
  }[page];

  const pageSubtitle = {
    rules: profileName ? 'Custom Rules' : undefined,
    filters: profileName ?? undefined,
  }[page];

  // Show loading splash while auto-validating stored token
  if (loading) return <Splash />;

  // Not authenticated — show login
  if (!token) return <LoginScreen />;

  const banner =
    clipboardDomain && activeProfile ? (
      <ClipboardBanner
        domain={clipboardDomain}
        onBypass={() => handleClipboardAction(RULE_ACTION.BYPASS)}
        onBlock={() => handleClipboardAction(RULE_ACTION.BLOCK)}
        onDismiss={dismiss}
      />
    ) : null;

  return (
    <Layout
      title={pageTitle}
      subtitle={pageSubtitle}
      page={page}
      onNavigate={setPage}
      onSettingsPress={page !== 'settings' ? () => setPage('settings') : undefined}
      banner={banner}
    >
      {page === 'profiles' && (
        <ProfileList
          activeProfile={activeProfile}
          onSelectProfile={handleSelectProfile}
        />
      )}

      {page === 'rules' && (
        <CustomRules
          profile={activeProfile}
          clipboardDomain={clipboardDomain}
          onClipboardAdd={addRuleRef}
        />
      )}

      {page === 'filters' && <Filters profile={activeProfile} />}

      {page === 'settings' && <Settings />}
    </Layout>
  );
}
