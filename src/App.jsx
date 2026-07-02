import { useState, useRef, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useClipboard } from './hooks/useClipboard';
import { RULE_ACTION } from './api/controld';

import OnboardingFlow from './components/OnboardingFlow';
import Layout from './components/Layout';
import ClipboardBanner from './components/ClipboardBanner';
import ProfileList from './components/ProfileList';
import CustomRules from './components/CustomRules';
import Filters from './components/Filters';
import Services from './components/Services';
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
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
    services: 'Services',
    settings: 'Settings',
  }[page];

  const pageSubtitle = {
    rules: profileName ? 'Custom Rules' : undefined,
    filters: profileName ?? undefined,
    services: profileName ?? undefined,
  }[page];

  // Show loading splash while auto-validating stored token
  if (loading) return <Splash />;

  // Not authenticated — show onboarding/login flow
  if (!token) return <OnboardingFlow />;

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
      {/* Keyed by page so navigating to another tab remounts the boundary and
          clears any caught error — a crashed screen never wedges the whole app. */}
      <ErrorBoundary key={page}>
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

        {page === 'services' && <Services profile={activeProfile} />}

        {page === 'settings' && <Settings />}
      </ErrorBoundary>
    </Layout>
  );
}
