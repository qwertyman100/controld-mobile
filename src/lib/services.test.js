import { describe, it, expect } from 'vitest';
import { mergeServiceState, filterServices } from './services.js';

const catalog = [
  { PK: 'netflix', name: 'Netflix', category: 'video', unlock_location: 'JFK', warning: '' },
  { PK: 'youtube', name: 'YouTube', category: 'video', unlock_location: 'JFK', warning: '' },
  { PK: 'disneyplus', name: 'Disney+', category: 'video', unlock_location: 'JFK', warning: '' },
];

describe('mergeServiceState', () => {
  it('annotates each catalog app with its configured action, via, and status', () => {
    const configured = [
      { PK: 'netflix', do: 1, status: 1, via: null },
      { PK: 'disneyplus', do: 3, status: 1, via: 'SYD' },
    ];
    const merged = mergeServiceState(catalog, configured);
    expect(merged.find((s) => s.PK === 'netflix')).toMatchObject({ action: 'bypass', status: 1 });
    expect(merged.find((s) => s.PK === 'disneyplus')).toMatchObject({ action: 'redirect', via: 'SYD', status: 1 });
  });

  it('leaves unconfigured apps with action null and status 0', () => {
    const merged = mergeServiceState(catalog, []);
    expect(merged.every((s) => s.action === null && s.status === 0)).toBe(true);
    expect(merged).toHaveLength(3);
  });

  it('treats a configured-but-disabled app (status 0) as action null', () => {
    const merged = mergeServiceState(catalog, [{ PK: 'youtube', do: 0, status: 0, via: null }]);
    expect(merged.find((s) => s.PK === 'youtube')).toMatchObject({ action: null, status: 0 });
  });

  it('maps do code 0 to block', () => {
    const merged = mergeServiceState(catalog, [{ PK: 'netflix', do: 0, status: 1, via: null }]);
    expect(merged.find((s) => s.PK === 'netflix').action).toBe('block');
  });
});

describe('filterServices', () => {
  const cat = [
    { PK: 'netflix', name: 'Netflix' },
    { PK: 'youtube', name: 'YouTube' },
    { PK: 'tiktok', name: 'TikTok' },
  ];

  it('matches on name, case-insensitively', () => {
    expect(filterServices(cat, 'net').map((s) => s.PK)).toEqual(['netflix']);
    expect(filterServices(cat, 'YOU').map((s) => s.PK)).toEqual(['youtube']);
  });

  it('matches on PK too', () => {
    expect(filterServices(cat, 'tiktok').map((s) => s.PK)).toEqual(['tiktok']);
  });

  it('returns the full list unchanged for empty or whitespace query', () => {
    expect(filterServices(cat, '')).toHaveLength(3);
    expect(filterServices(cat, '   ')).toHaveLength(3);
  });

  it('returns [] when nothing matches', () => {
    expect(filterServices(cat, 'zzzz')).toEqual([]);
  });
});
