import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleEditSheet from './RuleEditSheet';
import { RULE_ACTION } from '../api/controld';

const bypassRule = { hostname: 'x.com', do: RULE_ACTION.BYPASS, status: 1, via: null, via_v6: null };

describe('RuleEditSheet', () => {
  it('reveals the Spoof target input when Spoof is selected', () => {
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={() => {}} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText(/IPv4 or hostname/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    expect(screen.getByPlaceholderText(/IPv4 or hostname/)).toBeInTheDocument();
  });

  it('Save with a valid Spoof IP calls onSave with the built payload', () => {
    const onSave = vi.fn();
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    fireEvent.change(screen.getByPlaceholderText(/IPv4 or hostname/), { target: { value: '100.64.1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ do: RULE_ACTION.SPOOF, status: 1, via: '100.64.1.5' });
  });

  it('blocks Save on an invalid Spoof target and shows an error', () => {
    const onSave = vi.fn();
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    fireEvent.change(screen.getByPlaceholderText(/IPv4 or hostname/), { target: { value: 'bad;$char' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/IPv4 address or hostname/)).toBeInTheDocument();
  });
});
