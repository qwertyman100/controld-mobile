import { describe, it, expect } from 'vitest';
import { Smartphone, Router, Monitor, HardDrive } from 'lucide-react';
import {
  normaliseDevice,
  deviceChainLabel,
  deviceIcon,
  buildDeviceProfilePayload,
} from './devices';

const chained = {
  PK: '5855t6c6w8', name: 'STFU', status: 1, client_count: 1, ip_count: 50, icon: 'mobile-android',
  profile: { PK: '499929sjcgpis', name: 'Phone Extras' },
  profile2: { PK: '804860sjc5vs', name: 'Quiet Beacon Shield (02-01)' },
  resolvers: { doh: 'https://dns.controld.com/x', dot: 'x.dns.controld.com', v6: ['2606::1'] },
};
const unchained = {
  PK: '25y7b7dfg1t', name: 'IoT', status: 0, client_count: 5, ip_count: 1, icon: 'router-linux',
  profile: { PK: '805243sjcmou', name: 'IoT devices' },
};

describe('normaliseDevice', () => {
  it('reads a chained device', () => {
    const d = normaliseDevice(chained);
    expect(d).toMatchObject({
      id: '5855t6c6w8', name: 'STFU', online: true, clients: 1, ipCount: 50, icon: 'mobile-android',
      profileId: '499929sjcgpis', profileName: 'Phone Extras',
      profile2Id: '804860sjc5vs', profile2Name: 'Quiet Beacon Shield (02-01)',
    });
    expect(d.resolvers.doh).toBe('https://dns.controld.com/x');
  });
  it('reads an unchained, offline device (profile2 null)', () => {
    const d = normaliseDevice(unchained);
    expect(d.online).toBe(false);
    expect(d.profileId).toBe('805243sjcmou');
    expect(d.profile2Id).toBeNull();
    expect(d.profile2Name).toBeNull();
  });
  it('guards a device with no profile/resolvers', () => {
    const d = normaliseDevice({ PK: 'x', name: 'Bare', status: 1 });
    expect(d.profileId).toBeNull();
    expect(d.resolvers).toEqual({});
  });
});

describe('deviceChainLabel', () => {
  it('joins chained profiles with an arrow', () => {
    expect(deviceChainLabel(normaliseDevice(chained))).toBe('Phone Extras → Quiet Beacon Shield (02-01)');
  });
  it('shows just the profile when unchained', () => {
    expect(deviceChainLabel(normaliseDevice(unchained))).toBe('IoT devices');
  });
  it('is empty when there is no profile', () => {
    expect(deviceChainLabel(normaliseDevice({ PK: 'x', name: 'Bare' }))).toBe('');
  });
});

describe('deviceIcon', () => {
  it('maps known prefixes', () => {
    expect(deviceIcon('mobile-android')).toBe(Smartphone);
    expect(deviceIcon('router-firewalla')).toBe(Router);
    expect(deviceIcon('desktop-linux')).toBe(Monitor);
  });
  it('falls back to HardDrive', () => {
    expect(deviceIcon('something-else')).toBe(HardDrive);
    expect(deviceIcon(undefined)).toBe(HardDrive);
  });
});

describe('buildDeviceProfilePayload', () => {
  it('primary + chain', () => {
    expect(buildDeviceProfilePayload({ profileId: 'p1', profile2Id: 'p2' }))
      .toEqual({ profile_id: 'p1', profile_id2: 'p2' });
  });
  it('no chain → profile_id2 = -1 (remove)', () => {
    expect(buildDeviceProfilePayload({ profileId: 'p1', profile2Id: null }))
      .toEqual({ profile_id: 'p1', profile_id2: '-1' });
    expect(buildDeviceProfilePayload({ profileId: 'p1', profile2Id: '' }))
      .toEqual({ profile_id: 'p1', profile_id2: '-1' });
  });
});
