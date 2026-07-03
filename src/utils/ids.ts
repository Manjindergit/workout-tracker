/**
 * Lowercase UUID v4. Node 19+ and modern Hermes expose crypto.randomUUID; expo-crypto
 * is the fallback for native runtimes that don't.
 */
export function newId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID().toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require('expo-crypto') as { randomUUID: () => string };
  return Crypto.randomUUID().toLowerCase();
}
