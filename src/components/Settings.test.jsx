import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import Settings from './Settings';

describe('Settings About', () => {
  it('shows a build stamp so you can tell which bundle is running', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <Settings />
        </AuthProvider>
      </ThemeProvider>
    );
    // vite `define` injects __BUILD_STAMP__ during tests too, so the line renders.
    expect(screen.getByText(/^Build /)).toBeInTheDocument();
  });
});
