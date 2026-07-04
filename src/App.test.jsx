import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// vi.mock(...) is hoisted above top-level const declarations, so the spies it
// references must be created via vi.hoisted() to survive the hoist.
const { getUser, getProfiles, getRules, getGroups, getProxies, getDevices } = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({})),
  getProfiles: vi.fn(async () => ({ profiles: [] })),
  getRules: vi.fn(async () => ({ rules: [] })),
  getGroups: vi.fn(async () => ({ groups: [] })),
  getProxies: vi.fn(async () => ({ proxies: [] })),
  getDevices: vi.fn(async () => ({ devices: [] })),
}));

vi.mock('./api/controld', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: {
      getUser,
      getProfiles,
      getRules,
      getGroups,
      getProxies,
      getDevices,
    },
  };
});

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import App from './App';

// App itself doesn't wrap the context providers (main.jsx does that), so the
// test supplies them directly.
function renderApp() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe('App settings origin/back loop', () => {
  beforeEach(() => {
    // Seeding a token skips the onboarding/login flow and lands on Profiles.
    // Must satisfy validateToken's allowlist policy (>=16 chars, [A-Za-z0-9._-])
    // or AuthContext's startup re-validation logs it straight back out.
    localStorage.setItem('cd_token', 'test-token-1234567890');
  });

  // Regression coverage for Task 4: Settings moved from a bottom-nav tab to a
  // header gear, with App tracking `settingsOrigin` so the back-arrow returns
  // to whichever page opened Settings — not always Profiles.
  it('returns to the page that opened Settings, not always to Profiles', async () => {
    renderApp();

    // Past the auth-validation splash, onto the Profiles screen.
    await screen.findByRole('heading', { name: 'Profiles', level: 1 });

    // Navigate to Rules via the bottom nav.
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
    await screen.findByRole('heading', { name: 'Rules', level: 1 });

    // Open Settings via the header gear.
    fireEvent.click(screen.getByLabelText('Settings'));
    await screen.findByText('Disconnect');

    // Back must return to Rules (the recorded settingsOrigin), not Profiles.
    fireEvent.click(screen.getByLabelText('Back'));
    await screen.findByRole('heading', { name: 'Rules', level: 1 });
    expect(screen.queryByRole('heading', { name: 'Profiles', level: 1 })).toBeNull();
  });
});
