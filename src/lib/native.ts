/**
 * Capacitor native helpers for Google sign-in via system browser
 * and deep link handling.
 *
 * Uses window.Capacitor.plugins directly instead of dynamic imports
 * (import() with webpackIgnore does NOT work in Capacitor — the
 * runtime does not intercept ES module imports).
 */

interface CapacitorPluginApp {
  openUrl: (opts: { url: string }) => Promise<void>;
  addListener: (event: string, handler: (data: { url: string }) => void) => { remove: () => void };
}

interface CapacitorPluginLocalNotifications {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (opts: { notifications: Array<{ title: string; body: string; id: number; schedule: { at: Date }; sound?: string }> }) => Promise<void>;
  getPending: () => Promise<{ notifications: Array<{ id: number }> }>;
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
  addListener: (event: string, handler: () => void) => { remove: () => void };
}

interface CapacitorPlugins {
  App?: CapacitorPluginApp;
  LocalNotifications?: CapacitorPluginLocalNotifications;
}

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      plugins?: CapacitorPlugins;
    };
  }
}

export function isNative(): boolean {
  return typeof window !== "undefined" && window.Capacitor !== undefined;
}

function getApp(): CapacitorPluginApp | undefined {
  return window.Capacitor?.plugins?.App;
}

function getLN(): CapacitorPluginLocalNotifications | undefined {
  return window.Capacitor?.plugins?.LocalNotifications;
}

// ── Native Google sign-in (opens system browser) ──
//
// Uses a completely server-side OAuth flow that bypasses NextAuth's
// CSRF mechanism. The state parameter is stored server-side (no CSRF
// cookie needed), so there is no cookie mismatch between WebView and
// system browser.
//
// 1. App.openUrl() opens /api/auth/google-start in the system browser
// 2. google-start generates a state, stores it server-side, 302-redirects
//    to Google's OAuth URL
// 3. Google OAuth → callback to /api/auth/google-callback
// 4. google-callback validates state server-side, exchanges code for
//    tokens, creates/finds user, generates a one-time login code
// 5. User types the code in the app → exchange → session cookie

export function diagnoseCapacitor(): string {
  const parts: string[] = [];
  parts.push("Capacitor: " + (typeof window.Capacitor !== "undefined" ? "OK" : "MANQUANT"));
  parts.push("Plugins: " + (window.Capacitor?.plugins ? "OK" : "MANQUANT"));
  parts.push("App plugin: " + (window.Capacitor?.plugins?.App ? "OK" : "MANQUANT"));
  parts.push("LN plugin: " + (window.Capacitor?.plugins?.LocalNotifications ? "OK" : "MANQUANT"));
  parts.push("Browser plugin: " + (window.Capacitor?.plugins?.Browser ? "OK" : "MANQUANT"));
  parts.push("Origin: " + window.location.origin);
  return parts.join(" | ");
}

export async function signInWithGoogleNative(): Promise<boolean> {
  // First check via plugins
  const app = getApp();
  if (app) {
    try {
      const origin = window.location.origin || "https://gravio.onrender.com";
      await app.openUrl({ url: origin + "/api/auth/google-start" });
      return true;
    } catch {
      return false;
    }
  }

  // Fallback via Browser plugin if available
  const browser = window.Capacitor?.plugins?.Browser as { open?: (opts: { url: string }) => Promise<void> } | undefined;
  if (browser?.open) {
    try {
      const origin = window.location.origin || "https://gravio.onrender.com";
      await browser.open({ url: origin + "/api/auth/google-start" });
      return true;
    } catch {
      return false;
    }
  }

  // Last resort: try window.open
  try {
    const origin = window.location.origin || "https://gravio.onrender.com";
    const win = window.open(origin + "/api/auth/google-start", "_blank");
    if (win && !win.closed) return true;
  } catch {
    // ignore
  }

  return false;
}

// ── Deep link / app URL open listener ──

export type UrlOpenCallback = (url: string) => void;

export async function onAppUrlOpen(cb: UrlOpenCallback): Promise<() => void> {
  try {
    const app = getApp();
    if (!app) return () => {};
    const handler = await app.addListener("appUrlOpen", (data) => {
      cb(data.url);
    });
    return () => { handler.remove(); };
  } catch {
    return () => {};
  }
}

// ── Notification permission ──

export async function requestNativeNotificationPermission(): Promise<boolean> {
  try {
    const ln = getLN();
    if (!ln) return false;
    const perm = await ln.requestPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

// ── Local notifications ──

export async function scheduleNativeNotification(
  title: string,
  body: string,
  delayMs: number,
): Promise<boolean> {
  try {
    const ln = getLN();
    if (!ln) return false;
    await ln.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 2147483647),
          schedule: { at: new Date(Date.now() + delayMs) },
          sound: "beep.wav",
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelAllNativeNotifications(): Promise<void> {
  try {
    const ln = getLN();
    if (!ln) return;
    const pending = await ln.getPending();
    if (pending.notifications.length > 0) {
      await ln.cancel({ notifications: pending.notifications });
    }
  } catch { /* ignore */ }
}

export type NativeNotificationCallback = () => void;

export async function onNativeNotificationTap(cb: NativeNotificationCallback): Promise<() => void> {
  try {
    const ln = getLN();
    if (!ln) return () => {};
    const handler = await ln.addListener(
      "localNotificationActionPerformed",
      () => { cb(); },
    );
    return () => { handler.remove(); };
  } catch {
    return () => {};
  }
}
