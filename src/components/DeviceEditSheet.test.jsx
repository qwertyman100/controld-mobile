import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeviceEditSheet from './DeviceEditSheet';

const profiles = [
  { PK: 'p1', name: 'Phone Extras' },
  { PK: 'p2', name: 'Base' },
  { PK: 'p3', name: 'IoT devices' },
];
const device = {
  id: 'd1', name: 'STFU', online: true, clients: 1, ipCount: 50,
  profileId: 'p1', profile2Id: 'p2',
  resolvers: { doh: 'https://dns.controld.com/abc', dot: 'abc.dns.controld.com', v6: ['2606::1'] },
};

function renderSheet(overrides = {}) {
  const props = { device, profiles, onSave: vi.fn(), onClose: vi.fn(), ...overrides };
  render(<DeviceEditSheet {...props} />);
  return props;
}

describe('DeviceEditSheet', () => {
  it('renders connection info (DoH/DoT)', () => {
    renderSheet();
    expect(screen.getByText('https://dns.controld.com/abc')).toBeInTheDocument();
    expect(screen.getByText('abc.dns.controld.com')).toBeInTheDocument();
  });

  it('seeds the pickers from the device and saves primary + chain', () => {
    const { onSave } = renderSheet();
    const [primary, chain] = screen.getAllByRole('combobox');
    expect(primary.value).toBe('p1');
    expect(chain.value).toBe('p2');
    fireEvent.change(primary, { target: { value: 'p3' } });
    fireEvent.change(chain, { target: { value: 'p1' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ profile_id: 'p3', profile_id2: 'p1' });
  });

  it('choosing None for the chain sends profile_id2 = -1', () => {
    const { onSave } = renderSheet();
    const [, chain] = screen.getAllByRole('combobox');
    fireEvent.change(chain, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ profile_id: 'p1', profile_id2: '-1' });
  });
});
