/**
 * One-time login code store for Capacitor native auth flow.
 * In-memory Map (single-server, adequate for render.com).
 */

interface NativeAuthEntry {
  uid: string;
  email: string;
  name: string;
  image: string;
  createdAt: number;
}

const store = new Map<string, NativeAuthEntry>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Cleanup expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of store) {
    if (now - entry.createdAt > 300_000) store.delete(code); // 5 min expiry
  }
}, 300_000);

export function createNativeLoginCode(uid: string, email: string, name: string, image: string): string {
  const code = generateCode();
  store.set(code, { uid, email, name, image, createdAt: Date.now() });
  return code;
}

export function consumeNativeLoginCode(code: string): NativeAuthEntry | null {
  const entry = store.get(code);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 300_000) {
    store.delete(code);
    return null;
  }
  store.delete(code); // one-time use
  return entry;
}
