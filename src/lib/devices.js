import { Smartphone, Router, Monitor, HardDrive } from 'lucide-react';

// Normalise one GET /devices item into a stable shape. Missing profile/profile2/
// resolvers are guarded; numeric fields coerced. online = status 1.
export function normaliseDevice(d) {
  const profile = (d && d.profile) || {};
  const profile2 = (d && d.profile2) || null;
  return {
    id: String(d?.PK ?? d?.pk ?? d?.device_id ?? ''),
    name: String(d?.name ?? ''),
    status: Number(d?.status ?? 0),
    online: Number(d?.status ?? 0) === 1,
    clients: Number(d?.client_count ?? 0),
    ipCount: Number(d?.ip_count ?? 0),
    icon: String(d?.icon ?? ''),
    profileId: profile.PK != null ? String(profile.PK) : null,
    profileName: profile.name != null ? String(profile.name) : null,
    profile2Id: profile2 && profile2.PK != null ? String(profile2.PK) : null,
    profile2Name: profile2 && profile2.name != null ? String(profile2.name) : null,
    resolvers: (d && d.resolvers) || {},
  };
}

// "A → B" when chained, "A" when not, "" when there is no profile.
export function deviceChainLabel(device) {
  if (!device || !device.profileName) return '';
  return device.profile2Name ? `${device.profileName} → ${device.profile2Name}` : device.profileName;
}

// Map ControlD's icon-name string to a lucide component by prefix.
export function deviceIcon(iconName) {
  const n = String(iconName ?? '');
  if (n.startsWith('mobile')) return Smartphone;
  if (n.startsWith('router')) return Router;
  if (n.startsWith('desktop')) return Monitor;
  return HardDrive;
}

// Build the PUT /devices/{id} form body for a reassignment. profile2Id falsy
// (None chosen / unchained) → send '-1' to remove the chain.
export function buildDeviceProfilePayload({ profileId, profile2Id } = {}) {
  return { profile_id: profileId, profile_id2: profile2Id ? profile2Id : '-1' };
}
