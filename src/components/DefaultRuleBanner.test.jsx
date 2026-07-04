import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted spies — vi.mock is hoisted above top-level consts.
const { getProfiles, getProxies, getUser, setDefaultRule } = vi.hoisted(() => ({
  getProfiles: vi.fn(async () => ({ profiles: [{ PK: 'p1', profile: { da: { do: 0, status: 1 } } }] })),
  getProxies: vi.fn(async () => ({ proxies: [{ PK: 'DFW', city: 'Dallas', country: 'US' }] })),
  getUser: vi.fn(async () => ({})),
  setDefaultRule: vi.fn(async () => ({})),
}));

vi.mock('../api/controld', async (orig) => {
  const actual = await orig();
  return { ...actual, api: { getProfiles, getProxies, getUser, setDefaultRule } };
});

import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import DefaultRuleBanner from './DefaultRuleBanner';

function renderBanner() {
  render(
    <ToastProvider>
      <AuthProvider>
        <DefaultRuleBanner profile={{ PK: 'p1', name: 'Test', profile: { da: { do: 0, status: 1 } } }} />
      </AuthProvider>
    </ToastProvider>
  );
}

describe('DefaultRuleBanner', () => {
  beforeEach(() => {
    localStorage.setItem('cd_token', 'test-token');
    setDefaultRule.mockClear();
  });

  it('shows the current default action', async () => {
    renderBanner();
    await waitFor(() => expect(screen.getByText('Block')).toBeInTheDocument());
  });

  it('saving a new action calls setDefaultRule with the built payload', async () => {
    renderBanner();
    await waitFor(() => expect(screen.getByText('Block')).toBeInTheDocument());
    fireEvent.click(screen.getByText('When nothing matches'));   // open the sheet
    fireEvent.click(screen.getByText('Bypass'));                  // choose Bypass (sheet option)
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(setDefaultRule).toHaveBeenCalledTimes(1));
    expect(setDefaultRule.mock.calls[0][1]).toBe('p1');
    expect(setDefaultRule.mock.calls[0][2]).toEqual({ do: 1, status: 1 });
  });
});
