// src/lib/filterLevels.js

// AI Malware option strengths (malware Strict). Minimal is Control D's default.
export const AI_STRENGTHS = [
  { label: 'Minimal', value: 0.9 },
  { label: 'Standard', value: 0.7 },
  { label: 'Aggressive', value: 0.5 },
];
const AI_DEFAULT = 0.9;

function levelStatus(filter, name) {
  const l = (filter.levels || []).find((x) => x.name === name);
  return l ? Number(l.status) : 0;
}

/**
 * Read a native filter's level state. Titles come from the API (data-driven) —
 * they differ per filter (NRD uses "Last Week"/"Last Month"). Malware (PK
 * 'malware') is cumulative: its current level is the highest active layer.
 */
export function getFilterLevels(filter) {
  const levels = Array.isArray(filter?.levels) ? filter.levels : [];
  const isMultiLevel = levels.length > 0;
  const isCumulative = filter?.PK === 'malware';
  const options = ['Off', ...levels.map((l) => String(l.title))];

  let currentTitle = 'Off';
  if (isCumulative) {
    if (levelStatus(filter, 'ai_malware') === 1) currentTitle = 'Strict';
    else if (levelStatus(filter, 'ip_malware') === 1) currentTitle = 'Balanced';
    else if (levelStatus(filter, 'malware') === 1) currentTitle = 'Relaxed';
  } else if (isMultiLevel) {
    const active = levels.find((l) => l.name === filter?.action?.lvl);
    if (active) currentTitle = String(active.title);
  }

  const strict = levels.find((l) => l.name === 'ai_malware');
  const aiValue = strict?.opt?.[0]?.value ?? AI_DEFAULT;

  return { isMultiLevel, isCumulative, options, currentTitle, aiValue };
}

/**
 * Compute the API operations to set `filter` to `targetTitle`.
 * Exclusive filters → one filter-batch (enable chosen, disable siblings).
 * Malware (cumulative) → stacked malware/ip_malware layers + the ai_malware option.
 */
export function buildFilterLevelOps(filter, targetTitle, aiValue) {
  if (filter?.PK === 'malware') {
    const wantMalware = ['Relaxed', 'Balanced', 'Strict'].includes(targetTitle);
    const wantIp = ['Balanced', 'Strict'].includes(targetTitle);
    const wantAi = targetTitle === 'Strict';
    return {
      filters: [
        { filter: 'malware', status: wantMalware ? 1 : 0 },
        { filter: 'ip_malware', status: wantIp ? 1 : 0 },
      ],
      option: wantAi
        ? { name: 'ai_malware', status: 1, value: aiValue ?? AI_DEFAULT }
        : { name: 'ai_malware', status: 0 },
    };
  }
  const levels = Array.isArray(filter?.levels) ? filter.levels : [];
  return {
    filters: levels.map((l) => ({ filter: l.name, status: l.title === targetTitle ? 1 : 0 })),
    option: null,
  };
}

function stripTags(s) {
  return String(s ?? '').replace(/<[^>]*>/g, '');
}

/**
 * Parse a filter's `additional` HTML into { modeTitle: description }. The API
 * ships each mode as "<p><strong>LABEL</strong></p>TEXT"; LABEL is the mode title,
 * sometimes with a trailing " Mode" (Ads/Malware/Adult) and sometimes not (NRD's
 * "Last Week"/"Last Month"). All tags are stripped so the result is plain text —
 * safe to render as a React child (no dangerouslySetInnerHTML). Returns {} if the
 * field is empty or not in the expected shape.
 */
export function parseModeDescriptions(additional) {
  const html = String(additional ?? '');
  const re = /<p>\s*<strong>(.*?)<\/strong>\s*<\/p>(.*?)(?=<p>\s*<strong>|$)/gis;
  const out = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const label = stripTags(m[1]).replace(/\s*Mode\s*$/i, '').replace(/\s+/g, ' ').trim();
    const text = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (label) out[label] = text;
  }
  return out;
}
