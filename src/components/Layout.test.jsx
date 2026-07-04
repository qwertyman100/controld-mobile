import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import Layout from './Layout';

function renderLayout(props = {}) {
  return render(
    <ThemeProvider>
      <Layout title="Profiles" page="profiles" onNavigate={() => {}} {...props}>
        <div>content</div>
      </Layout>
    </ThemeProvider>
  );
}

describe('Layout header', () => {
  // Task 4 deliberately reintroduced a header Settings gear (it used to be a
  // bottom-nav tab). It renders on every page except Settings itself, and
  // only when onOpenSettings is supplied — clicking it hands control to the
  // caller (App wires it to openSettings, which records settingsOrigin).
  it('shows a Settings gear that calls onOpenSettings when clicked', () => {
    const onOpenSettings = vi.fn();
    renderLayout({ page: 'rules', onOpenSettings });

    const header = screen.getByRole('banner');
    expect(within(header).getByLabelText('Toggle theme')).toBeInTheDocument();

    const settingsBtn = within(header).getByLabelText('Settings');
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  // On the Settings page itself the gear must hide — even though
  // onOpenSettings is still passed — because the existing back-arrow is the
  // exit from Settings (a visible gear there would be a dead-end / no-op).
  it('hides the Settings gear on the settings page and uses Back to exit instead', () => {
    const onOpenSettings = vi.fn();
    const onBack = vi.fn();
    renderLayout({ page: 'settings', showBack: true, onBack, onOpenSettings });

    const header = screen.getByRole('banner');
    expect(within(header).queryByLabelText('Settings')).toBeNull();

    const backBtn = within(header).getByLabelText('Back');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
