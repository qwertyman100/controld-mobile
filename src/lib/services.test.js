import { describe, it, expect } from 'vitest';
import {
  mergeServiceState,
  filterServices,
  buildServicePayload,
  resolveDefaultLocation,
} from './services.js';

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

  // Regression: the live catalog contains a service ("1688", in shop) whose
  // name AND PK are NUMBERS, not strings. Unguarded .toLowerCase() on a number
  // throws and white-screens the whole app on the first search keystroke.
  it('handles non-string name/PK (e.g. numeric 1688) without throwing', () => {
    const withNumeric = [
      { PK: 1688, name: 1688 },
      { PK: 'netflix', name: 'Netflix' },
    ];
    expect(() => filterServices(withNumeric, 'net')).not.toThrow();
    expect(filterServices(withNumeric, '168').map((s) => s.PK)).toEqual([1688]);
    expect(filterServices(withNumeric, 'net').map((s) => s.PK)).toEqual(['netflix']);
  });
});

describe('buildServicePayload', () => {
  it('block -> {do:0,status:1}', () => {
    expect(buildServicePayload('block')).toEqual({ do: 0, status: 1 });
  });
  it('bypass -> {do:1,status:1}', () => {
    expect(buildServicePayload('bypass')).toEqual({ do: 1, status: 1 });
  });
  it('redirect -> {do:3,status:1,via}', () => {
    expect(buildServicePayload('redirect', 'SYD')).toEqual({ do: 3, status: 1, via: 'SYD' });
  });
  it('off -> {status:0}', () => {
    expect(buildServicePayload('off')).toEqual({ status: 0 });
  });
  it('throws on an unknown action', () => {
    expect(() => buildServicePayload('spoof')).toThrow();
  });
});

describe('resolveDefaultLocation', () => {
  const proxies = [
    { PK: 'JFK', city: 'New York', country_name: 'United States' },
    { PK: 'SYD', city: 'Sydney', country_name: 'Australia' },
  ];

  it('returns the proxy whose PK matches the service unlock_location', () => {
    expect(resolveDefaultLocation({ unlock_location: 'SYD' }, proxies))
      .toMatchObject({ PK: 'SYD', city: 'Sydney' });
  });
  it('returns null when unlock_location is empty', () => {
    expect(resolveDefaultLocation({ unlock_location: '' }, proxies)).toBeNull();
  });
  it('returns null when no proxy matches', () => {
    expect(resolveDefaultLocation({ unlock_location: 'ZZZ' }, proxies)).toBeNull();
  });
  it('returns null for a service with no unlock_location', () => {
    expect(resolveDefaultLocation({}, proxies)).toBeNull();
  });
});
