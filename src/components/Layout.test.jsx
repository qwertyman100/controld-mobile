import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  // Regression: the header used to have a Settings gear that navigated into
  // Settings — but the gear hid itself there and Settings is a bottom-nav tab,
  // creating a dead-end. The header must have the theme toggle and NO Settings gear.
  it('has a theme toggle but no Settings gear in the header', () => {
    renderLayout();
    const header = screen.getByRole('banner');
    expect(within(header).getByLabelText('Toggle theme')).toBeInTheDocument();
    expect(within(header).queryByLabelText('Settings')).toBeNull();
  });
});
