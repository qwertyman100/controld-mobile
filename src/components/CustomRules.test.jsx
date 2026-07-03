import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Regression for a CRITICAL crash: the proxy-load effect used to seed `via`
// straight from a proxy's PK (`setVia(first.PK ?? ...)`), and proxy PKs are
// numeric. Selecting Spoof then evaluates `!via.trim()` in the Add-button
// disabled guard, which throws (`via.trim is not a function`) when `via` is
// a number. Fix wraps both the seed and the guard in String(...).
vi.mock('../api/controld', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: {
      getRules: async () => ({ rules: [] }),
      getGroups: async () => ({ groups: [] }),
      getProxies: async () => ({ proxies: [{ PK: 1234, name: 'Test Loc' }] }), // numeric PK — the crash trigger
      getUser: async () => ({}),
    },
  };
});

import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import CustomRules from './CustomRules';

describe('CustomRules', () => {
  it('does not crash when selecting Spoof after a numeric-PK proxy loads', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <CustomRules profile={{ PK: 'p1', name: 'Test' }} />
        </AuthProvider>
      </ToastProvider>
    );

    // Select Redirect first and wait for the real proxy option to render — this is
    // the observable signal that the async getProxies() effect has resolved and
    // `via` has already been seeded from the numeric PK (1234), not just that the
    // static action buttons exist.
    fireEvent.click(screen.getByRole('button', { name: 'Redirect' }));
    await waitFor(() => expect(screen.getByText(/Test Loc/)).toBeInTheDocument());

    // Fill the domain field so the disabled guard's leading `!domain.trim()` is
    // false — otherwise the `||` chain short-circuits before ever reaching
    // `!via.trim()` and the bug would go unexercised.
    fireEvent.change(screen.getByPlaceholderText(/domain.com/), { target: { value: 'example.com' } });

    // Now switch to Spoof. On pre-fix code `via` is still the numeric 1234 seeded
    // above, so the Add-button's disabled guard (`!via.trim()`) throws synchronously
    // inside this click's render (`via.trim is not a function`).
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));

    // If via were numeric and unguarded, evaluating the disabled guard on the next
    // render would throw; instead the Spoof target input should appear.
    await waitFor(() => expect(screen.getByPlaceholderText(/IPv4 or hostname/)).toBeInTheDocument());
  });
});
