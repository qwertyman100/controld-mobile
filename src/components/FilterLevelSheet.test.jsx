import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FilterLevelSheet from './FilterLevelSheet';

const nrd = {
  PK: 'nrd',
  name: 'New Domains',
  additional:
    '<p><strong>Last Week</strong></p>Blocks domains registered in the last week. <p><strong>Last Month</strong></p>Blocks domains registered in the last month.',
  action: null, // raw state = Off
  levels: [
    { title: 'Last Week', name: 'nrd_small', status: 0 },
    { title: 'Last Month', name: 'nrd', status: 0 },
  ],
};

describe('FilterLevelSheet', () => {
  // Regression: the sheet re-derived "current" from the raw filter object (Off),
  // ignoring the optimistic override — so after setting a level, reopening showed
  // Off instead of the level just chosen.
  it('marks the OVERRIDE level as current, not the stale raw level', () => {
    render(
      <FilterLevelSheet filter={nrd} currentOverride="Last Month" onChoose={() => {}} onClose={() => {}} />
    );
    expect(screen.getByRole('button', { name: /Last Month/ })).toHaveTextContent('current');
    expect(screen.getByRole('button', { name: /^Off/ })).not.toHaveTextContent('current');
  });

  it('falls back to the raw current level when there is no override', () => {
    render(<FilterLevelSheet filter={nrd} onChoose={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /^Off/ })).toHaveTextContent('current');
    expect(screen.getByRole('button', { name: /Last Month/ })).not.toHaveTextContent('current');
  });

  it("renders each mode's description as plain text (parsed from additional HTML)", () => {
    render(<FilterLevelSheet filter={nrd} onChoose={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/registered in the last month/)).toBeInTheDocument();
  });
});
