import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DefaultRuleSheet from './DefaultRuleSheet';

const proxies = [{ PK: 'DFW', city: 'Dallas', country: 'US' }];

function renderSheet(overrides = {}) {
  const props = {
    da: { do: 1, status: 1, via: null },
    proxies,
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<DefaultRuleSheet {...props} />);
  return props;
}

describe('DefaultRuleSheet', () => {
  it('selecting Redirect reveals the location select', () => {
    renderSheet();
    expect(screen.queryByText('Redirect location')).toBeNull();
    fireEvent.click(screen.getByText('Redirect'));
    expect(screen.getByText('Redirect location')).toBeInTheDocument();
  });

  it('selecting Block shows the allowlist warning', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Block'));
    expect(screen.getByText(/allowlist/i)).toBeInTheDocument();
  });

  it('blocks saving Redirect with no location and does not call onSave', () => {
    const { onSave } = renderSheet();
    fireEvent.click(screen.getByText('Redirect'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose a location/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saving Bypass calls onSave with {do:1,status:1}', () => {
    const { onSave } = renderSheet({ da: { do: 0, status: 1, via: null } });
    fireEvent.click(screen.getByText('Bypass'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ do: 1, status: 1 });
  });

  it('saving Redirect with a location calls onSave with the via', () => {
    const { onSave } = renderSheet();
    fireEvent.click(screen.getByText('Redirect'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DFW' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ do: 3, status: 1, via: 'DFW' });
  });
});
