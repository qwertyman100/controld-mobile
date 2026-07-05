// Normalise the app's origin into a clean shareable URL for the "Add another
// device" QR/link. Strips trailing slashes and whitespace; empty/nullish → ''.
export function buildShareUrl(origin) {
  const s = String(origin ?? '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}
