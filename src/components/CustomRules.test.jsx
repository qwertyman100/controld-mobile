import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Regression for a CRITICAL crash: the proxy-load effect used to seed `via`
// straight from a proxy's PK (`setVia(first.PK ?? ...)`), and proxy PKs are
// numeric. Selecting Spoof then evaluates `!via.trim()` in the Add-button
// disabled guard, which throws (`via.trim is not a function`) when `via` is
// a number. Fix wraps both the seed and the guard in String(...).
// vi.mock(...) below is hoisted above top-level const declarations, so the
// spies it references must be created via vi.hoisted() to survive the hoist.
const { updateRule, createRule } = vi.hoisted(() => ({
  updateRule: vi.fn(async () => ({})),
  createRule: vi.fn(async () => ({})),
}));

vi.mock('../api/controld', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    api: {
      // A DISABLED rule (nested action.status: 0) — used by the Fix 1
      // regression test below (editing must not silently re-enable it).
      getRules: async () => ({
        rules: [
          { PK: 'blocked.example', action: { do: 0, status: 0 } },
        ],
      }),
      getGroups: async () => ({ groups: [] }),
      getProxies: async () => ({ proxies: [{ PK: 1234, name: 'Test Loc' }] }), // numeric PK — the crash trigger
      getUser: async () => ({}),
      // CustomRules now renders <DefaultRuleBanner>, which calls these on mount
      // (guarded by a truthy token). Stub them so a future test that seeds
      // cd_token can't trip over `api.getProfiles is not a function` in an effect.
      getProfiles: async () => ({ profiles: [] }),
      setDefaultRule: async () => ({}),
      updateRule,
      createRule,
    },
  };
});

import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import CustomRules from './CustomRules';

describe('CustomRules', () => {
  beforeEach(() => {
    updateRule.mockClear();
    createRule.mockClear();
  });

  // Regression for Fix 1: buildRulePayload hardcodes status:1, and
  // handleEditSave used to spread it straight into the PUT body — so editing
  // a disabled rule (even with no changes) silently flipped it back on.
  // The fix overrides the payload's status with the rule's own status.
  it('preserves a disabled rule\'s status when saving an edit with no changes', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <CustomRules profile={{ PK: 'p1', name: 'Test' }} />
        </AuthProvider>
      </ToastProvider>
    );

    const editBtn = await screen.findByLabelText('Edit rule for blocked.example');
    fireEvent.click(editBtn);

    const saveBtn = await screen.findByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateRule).toHaveBeenCalled());
    const [, , body] = updateRule.mock.calls[0];
    expect(body.status).toBe(0);
    // Regression for the live-caught 400 (code 40003 "Hostaname(s) was not
    // supplied"): ControlD's PUT /rules identifies the target with hostnames[]
    // (array), exactly like POST — NOT a singular `hostname`. Sending `hostname`
    // is silently rejected. The body must carry the 'hostnames[]' key.
    expect(body['hostnames[]']).toBe('blocked.example');
    expect(body.hostname).toBeUndefined();
  });

  // Regression for the same live-caught 400 on the OTHER updateRule caller:
  // toggling a rule's status also went through singular `hostname` and 400'd
  // (silently, masked by the optimistic-UI rollback). Toggle must use hostnames[].
  it('toggles a rule using the hostnames[] identifier (not singular hostname)', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <CustomRules profile={{ PK: 'p1', name: 'Test' }} />
        </AuthProvider>
      </ToastProvider>
    );

    // blocked.example is seeded disabled (status:0), so its row toggle re-enables it.
    const toggleBtn = await screen.findByRole('button', { name: /Enable rule|Disable rule/ });
    fireEvent.click(toggleBtn);

    await waitFor(() => expect(updateRule).toHaveBeenCalled());
    const [, , body] = updateRule.mock.calls[0];
    expect(body['hostnames[]']).toBe('blocked.example');
    expect(body.hostname).toBeUndefined();
  });

  // Regression for Fix 2: the add-bar's Spoof target is free text, but addRule
  // never validated it before Fix 2 — an invalid target would be sent straight
  // to the API. The fix runs validateSpoofTarget() before api.createRule().
  it('blocks adding a Spoof rule with an invalid target', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <CustomRules profile={{ PK: 'p1', name: 'Test' }} />
        </AuthProvider>
      </ToastProvider>
    );

    // Wait for the numeric-PK proxy to load so the component is fully settled.
    fireEvent.click(screen.getByRole('button', { name: 'Redirect' }));
    await waitFor(() => expect(screen.getByText(/Test Loc/)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/domain.com/), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));

    const targetInput = await screen.findByPlaceholderText(/IPv4 or hostname/);
    fireEvent.change(targetInput, { target: { value: 'bad;$char' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByText(/Enter an IPv4 address or hostname\.|Not a valid/)).toBeInTheDocument());
    expect(createRule).not.toHaveBeenCalled();
  });

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
