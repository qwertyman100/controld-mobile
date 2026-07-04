import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomNav from './BottomNav';

describe('BottomNav', () => {
  it('shows Devices as the 5th tab and no longer shows Settings', () => {
    render(<BottomNav current="profiles" onNavigate={() => {}} />);
    expect(screen.getByRole('button', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('navigates when a tab is tapped', () => {
    const onNavigate = vi.fn();
    render(<BottomNav current="profiles" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Devices' }));
    expect(onNavigate).toHaveBeenCalledWith('devices');
  });
});
