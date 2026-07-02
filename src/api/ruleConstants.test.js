// Tests for the rule constant maps. These encode the Control D API's numeric
// contract (0=BLOCK, 1=BYPASS, 2=SPOOF, 3=REDIRECT / 0=DISABLED, 1=ENABLED), so
// the tests pin those exact values and — most usefully — assert that every
// action has a human label, catching a future action added without one.
import { describe, it, expect } from 'vitest';
import { RULE_ACTION, RULE_ACTION_LABEL, RULE_STATUS } from './controld.js';

describe('rule constants', () => {
  it('RULE_ACTION matches the API numeric contract', () => {
    expect(RULE_ACTION).toEqual({ BLOCK: 0, BYPASS: 1, SPOOF: 2, REDIRECT: 3 });
  });

  it('RULE_STATUS matches the API numeric contract', () => {
    expect(RULE_STATUS).toEqual({ DISABLED: 0, ENABLED: 1 });
  });

  it('maps each action code to its display label', () => {
    expect(RULE_ACTION_LABEL[RULE_ACTION.BLOCK]).toBe('Block');
    expect(RULE_ACTION_LABEL[RULE_ACTION.BYPASS]).toBe('Bypass');
    expect(RULE_ACTION_LABEL[RULE_ACTION.SPOOF]).toBe('Spoof');
    expect(RULE_ACTION_LABEL[RULE_ACTION.REDIRECT]).toBe('Redirect');
  });

  it('has a label for every action (no unlabeled actions)', () => {
    for (const code of Object.values(RULE_ACTION)) {
      expect(RULE_ACTION_LABEL[code]).toBeTruthy();
    }
    // and no orphan labels beyond the defined actions
    expect(Object.keys(RULE_ACTION_LABEL).length).toBe(Object.keys(RULE_ACTION).length);
  });
});
