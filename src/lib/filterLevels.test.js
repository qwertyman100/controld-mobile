// src/lib/filterLevels.test.js
import { describe, it, expect } from 'vitest';
import { getFilterLevels } from './filterLevels.js';

const ads = {
  PK: 'ads', name: 'Ads & Trackers', action: { lvl: 'ads' },
  levels: [
    { title: 'Relaxed', name: 'ads_small', type: 'filter', status: 0 },
    { title: 'Balanced', name: 'ads_medium', type: 'filter', status: 0 },
    { title: 'Strict', name: 'ads', type: 'filter', status: 1 },
  ],
};
const nrd = {
  PK: 'nrd', name: 'New Domains', action: { lvl: 'nrd_small' },
  levels: [
    { title: 'Last Week', name: 'nrd_small', type: 'filter', status: 1 },
    { title: 'Last Month', name: 'nrd', type: 'filter', status: 0 },
  ],
};
const porn = {
  PK: 'porn', name: 'Adult Content', action: null,
  levels: [
    { title: 'Relaxed', name: 'porn', type: 'filter', status: 0 },
    { title: 'Strict', name: 'porn_strict', type: 'filter', status: 0 },
  ],
};
function malware(mw, ip, ai) {
  return {
    PK: 'malware', name: 'Malware', action: { do: 0, status: 1 },
    levels: [
      { title: 'Relaxed', name: 'malware', type: 'filter', status: mw },
      { title: 'Balanced', name: 'ip_malware', type: 'ipfilter', status: ip },
      { title: 'Strict', name: 'ai_malware', type: 'option', status: ai, opt: [{ PK: 'ai_malware', value: 0.9 }] },
    ],
  };
}
const simple = { PK: 'gambling', name: 'Gambling', status: 0 };

describe('getFilterLevels', () => {
  it('marks a filter with a non-empty levels array as multi-level', () => {
    expect(getFilterLevels(ads).isMultiLevel).toBe(true);
    expect(getFilterLevels(simple).isMultiLevel).toBe(false);
  });
  it('builds options as Off + the data-driven level titles (not hardcoded)', () => {
    expect(getFilterLevels(ads).options).toEqual(['Off', 'Relaxed', 'Balanced', 'Strict']);
    expect(getFilterLevels(nrd).options).toEqual(['Off', 'Last Week', 'Last Month']);
    expect(getFilterLevels(simple).options).toEqual(['Off']);
  });
  it('derives current title from action.lvl for mutually-exclusive filters', () => {
    expect(getFilterLevels(ads).currentTitle).toBe('Strict');
    expect(getFilterLevels(nrd).currentTitle).toBe('Last Week');
    expect(getFilterLevels(porn).currentTitle).toBe('Off');
  });
  it('flags malware as cumulative and derives current from layer statuses', () => {
    expect(getFilterLevels(malware(1, 1, 1)).isCumulative).toBe(true);
    expect(getFilterLevels(malware(1, 1, 1)).currentTitle).toBe('Strict');
    expect(getFilterLevels(malware(1, 1, 0)).currentTitle).toBe('Balanced');
    expect(getFilterLevels(malware(1, 0, 0)).currentTitle).toBe('Relaxed');
    expect(getFilterLevels(malware(0, 0, 0)).currentTitle).toBe('Off');
  });
  it('reads the malware AI value (default 0.9)', () => {
    expect(getFilterLevels(malware(1, 1, 1)).aiValue).toBe(0.9);
  });
  it('does not throw on missing/garbage input', () => {
    expect(() => getFilterLevels({})).not.toThrow();
    expect(getFilterLevels({}).isMultiLevel).toBe(false);
  });
});

import { buildFilterLevelOps } from './filterLevels.js';

describe('buildFilterLevelOps', () => {
  const ads = {
    PK: 'ads',
    levels: [
      { title: 'Relaxed', name: 'ads_small' },
      { title: 'Balanced', name: 'ads_medium' },
      { title: 'Strict', name: 'ads' },
    ],
  };
  const malware = { PK: 'malware', levels: [] }; // cumulative logic is by PK, not levels

  it('exclusive: enables the chosen level key, disables siblings, no option', () => {
    expect(buildFilterLevelOps(ads, 'Balanced')).toEqual({
      filters: [
        { filter: 'ads_small', status: 0 },
        { filter: 'ads_medium', status: 1 },
        { filter: 'ads', status: 0 },
      ],
      option: null,
    });
  });
  it('exclusive: Off disables every level key', () => {
    expect(buildFilterLevelOps(ads, 'Off').filters.every((f) => f.status === 0)).toBe(true);
  });
  it('cumulative malware Off: all layers off + ai option off', () => {
    expect(buildFilterLevelOps(malware, 'Off')).toEqual({
      filters: [{ filter: 'malware', status: 0 }, { filter: 'ip_malware', status: 0 }],
      option: { name: 'ai_malware', status: 0 },
    });
  });
  it('cumulative malware Relaxed / Balanced stack the layers, ai off', () => {
    expect(buildFilterLevelOps(malware, 'Relaxed').filters).toEqual([
      { filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 0 },
    ]);
    expect(buildFilterLevelOps(malware, 'Balanced').filters).toEqual([
      { filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 1 },
    ]);
    expect(buildFilterLevelOps(malware, 'Balanced').option).toEqual({ name: 'ai_malware', status: 0 });
  });
  it('cumulative malware Strict: all layers on + ai option on with the given strength', () => {
    expect(buildFilterLevelOps(malware, 'Strict', 0.7)).toEqual({
      filters: [{ filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 1 }],
      option: { name: 'ai_malware', status: 1, value: 0.7 },
    });
  });
  it('cumulative malware Strict defaults AI strength to 0.9', () => {
    expect(buildFilterLevelOps(malware, 'Strict').option.value).toBe(0.9);
  });
});

import { parseModeDescriptions } from './filterLevels.js';

describe('parseModeDescriptions', () => {
  const adsAdditional =
    '<p><strong>Relaxed Mode</strong></p>Smallest block list, will only block very common ads and trackers. Least prone to false positives. <p><strong>Balanced Mode</strong></p>Medium sized block list, will block a lot more than the Relaxed mode, but still allow common affiliate and email tracking links. <p><strong>Strict Mode</strong></p>Will block the most ads and trackers, but also has the highest chance of false positives.';
  const nrdAdditional =
    '<p><strong>Last Week</strong></p>Blocks domains that were registered in the last week. <p><strong>Last Month</strong></p>Blocks domains that were registered in the last month.';

  it('parses mode descriptions keyed by title, stripping a trailing " Mode"', () => {
    const m = parseModeDescriptions(adsAdditional);
    expect(m.Relaxed).toMatch(/^Smallest block list/);
    expect(m.Balanced).toMatch(/affiliate and email tracking links\.$/);
    expect(m.Strict).toMatch(/highest chance of false positives\.$/);
  });

  it('handles labels without a " Mode" suffix (NRD Last Week / Last Month)', () => {
    const m = parseModeDescriptions(nrdAdditional);
    expect(m['Last Week']).toBe('Blocks domains that were registered in the last week.');
    expect(m['Last Month']).toBe('Blocks domains that were registered in the last month.');
  });

  it('strips nested tags from the description text', () => {
    expect(parseModeDescriptions('<p><strong>Relaxed Mode</strong></p>Safe <b>bold</b> text'))
      .toEqual({ Relaxed: 'Safe bold text' });
  });

  it('returns {} for empty / non-string / markup-less input', () => {
    expect(parseModeDescriptions('')).toEqual({});
    expect(parseModeDescriptions(null)).toEqual({});
    expect(parseModeDescriptions(undefined)).toEqual({});
    expect(parseModeDescriptions('plain text, no markup')).toEqual({});
  });
});
