import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { getDevices, getProfiles, getUser, updateDevice } = vi.hoisted(() => ({
  getDevices: vi.fn(async () => ({ devices: [
    { PK: 'd1', name: 'STFU', status: 1, client_count: 1, ip_count: 50, icon: 'mobile-android',
      profile: { PK: 'p1', name: 'Phone Extras' }, profile2: { PK: 'p2', name: 'Base' },
      resolvers: { doh: 'https://dns.controld.com/d1', dot: 'd1.dns.controld.com', v6: [] } },
    { PK: 'd2', name: 'IoT', status: 0, client_count: 5, ip_count: 1, icon: 'router-linux',
      profile: { PK: 'p3', name: 'IoT devices' }, resolvers: {} },
  ] })),
  getProfiles: vi.fn(async () => ({ profiles: [
    { PK: 'p1', name: 'Phone Extras' }, { PK: 'p2', name: 'Base' }, { PK: 'p3', name: 'IoT devices' },
  ] })),
  getUser: vi.fn(async () => ({})),
  updateDevice: vi.fn(async () => ({})),
}));

vi.mock('../api/controld', async (orig) => {
  const actual = await orig();
  return { ...actual, api: { getDevices, getProfiles, getUser, updateDevice } };
});

import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import DeviceList from './DeviceList';

function renderList() {
  render(
    <ToastProvider>
      <AuthProvider>
        <DeviceList />
      </AuthProvider>
    </ToastProvider>
  );
}

describe('DeviceList', () => {
  beforeEach(() => {
    localStorage.setItem('cd_token', 'test-token');
    updateDevice.mockClear();
  });

  it('renders devices with their profile chain', async () => {
    renderList();
    expect(await screen.findByText('STFU')).toBeInTheDocument();
    expect(screen.getByText('Phone Extras → Base')).toBeInTheDocument();
    expect(screen.getByText('IoT devices')).toBeInTheDocument();
  });

  it('opens a device and saves a reassignment via updateDevice', async () => {
    renderList();
    fireEvent.click(await screen.findByText('STFU'));
    // sheet open — change the chain to None and save
    const combos = await screen.findAllByRole('combobox');
    fireEvent.change(combos[1], { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateDevice).toHaveBeenCalledTimes(1));
    expect(updateDevice.mock.calls[0][1]).toBe('d1');
    expect(updateDevice.mock.calls[0][2]).toEqual({ profile_id: 'p1', profile_id2: '-1' });
  });
});
