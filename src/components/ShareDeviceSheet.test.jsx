import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext';
import { buildShareUrl } from '../lib/shareDevice';
import ShareDeviceSheet from './ShareDeviceSheet';

const APP_URL = buildShareUrl(window.location.origin); // jsdom origin (e.g. http://localhost:3000)

function renderSheet() {
  render(<ToastProvider><ShareDeviceSheet onClose={() => {}} /></ToastProvider>);
}

describe('ShareDeviceSheet', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => {}) }, configurable: true,
    });
    // ensure Share is unavailable by default
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  afterEach(() => {
    delete navigator.share;
  });

  it('renders a QR code and the app URL', () => {
    renderSheet();
    expect(document.querySelector('svg')).toBeTruthy();        // QRCodeSVG renders an <svg>
    expect(screen.getByText(APP_URL)).toBeInTheDocument();
  });

  it('Copy link writes the URL to the clipboard', async () => {
    renderSheet();
    fireEvent.click(screen.getByText('Copy link'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(APP_URL));
  });

  it('hides Share when navigator.share is unavailable', () => {
    renderSheet();
    expect(screen.queryByText('Share…')).toBeNull();
  });

  it('shows Share and calls navigator.share when available', async () => {
    const shareFn = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true });
    renderSheet();
    fireEvent.click(screen.getByText('Share…'));
    await waitFor(() => expect(shareFn).toHaveBeenCalled());
  });
});
