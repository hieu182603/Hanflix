import type { CreateCheckoutInput } from '../api/billing';

const memoryKeys = new Map<string, string>();
export function newBillingRequestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function checkoutRequest(userId: string, input: CreateCheckoutInput) {
  return pendingBillingRequest(`checkout:${userId}:${input.planCode}:${input.expectedPrice}`);
}
export function pendingBillingRequest(scope: string) {
  const storageKey = `hanflix:${scope}`;
  let key = memoryKeys.get(storageKey);
  try { key = sessionStorage.getItem(storageKey) || key; } catch { /* storage may be unavailable */ }
  if (!key) key = newBillingRequestKey();
  memoryKeys.set(storageKey, key);
  try { sessionStorage.setItem(storageKey, key); } catch { /* retain in memory */ }
  return { key, clear: () => {
    memoryKeys.delete(storageKey);
    try { sessionStorage.removeItem(storageKey); } catch { /* no persistent storage */ }
  } };
}
