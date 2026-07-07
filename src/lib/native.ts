/**
 * Capacitor native helpers for Google sign-in via system browser
 * and deep link handling.
 *
 * Uses window.Capacitor.plugins directly instead of static imports
 * to avoid bundling native-only modules on web.
 *
 * Static imports from @capgo/capacitor-social-login cause runtime
 * errors on web because registerPlugin() evaluates during module
 * init.  Reading from window.Capacitor.plugins.SocialLogin is the
 * safest pattern — it is only defined on native Capacitor builds.
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

interface CapacitorPluginBrowser {
  open: (opts: { url: string }) => Promise<void>;
}

interface CapacitorPluginSocialLogin {
  initialize: (opts: { google: { webClientId: string; mode: string } }) => Promise<void>;
  login: (opts: { provider: string; options: { scopes: string[] } }) => Promise<unknown>;
}

interface CapacitorPlugins {
  App?: CapacitorPluginApp;
  LocalNotifications?: CapacitorPluginLocalNotifications;
  Browser?: CapacitorPluginBrowser;
  SocialLogin?: CapacitorPluginSocialLogin;
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
  parts.push("SocialLogin plugin: " + (window.Capacitor?.plugins?.SocialLogin ? "OK" : "MANQUANT"));
  parts.push("Origin: " + window.location.origin);
  return parts.join(" | ");
}

function getSocialLogin(): CapacitorPluginSocialLogin {
  const sl = window.Capacitor?.plugins?.SocialLogin;
  if (!sl) {
    throw new Error("Plugin SocialLogin non disponible");
  }
  return sl;
}

export async function signInWithGoogleNativePlugin(): Promise<{ success: boolean; error?: string }> {
  if (!isNative()) {
    return { success: false, error: "Pas sur une plateforme native" };
  }

  try {
    const statusRes = await fetch("/api/auth/status");
    const statusData = await statusRes.json();
    const webClientId = statusData.webClientId as string | undefined;

    if (!webClientId) {
      return { success: false, error: "Google non configuré sur le serveur" };
    }

    const sl = getSocialLogin();
    await sl.initialize({
      google: {
        webClientId,
        mode: "online",
      },
    });

    const result = await sl.login({
      provider: "google",
      options: {
        scopes: ["profile", "email"],
      },
    }) as { provider: string; result: { responseType: string; idToken?: string } };

    if (result.provider !== "google" || result.result.responseType !== "online") {
      return { success: false, error: "Réponse inattendue du plugin" };
    }

    const idToken = result.result.idToken;
    if (!idToken) {
      return { success: false, error: "Aucun idToken reçu" };
    }

    const exchangeRes = await fetch("/api/auth/native-google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok || !exchangeData.success) {
      return { success: false, error: exchangeData.error || "Échec de l'échange du token" };
    }

    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "USER_CANCELLED") {
      return { success: false, error: "Connexion annulée" };
    }
    return { success: false, error: err.message || "Erreur inconnue" };
  }
}

export function getGoogleLoginUrl(): string {
  // Use window.location.origin — in Capacitor this matches server.url
  // from capacitor.config.ts (respects CAP_SERVER_URL for local dev).
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gravio.onrender.com";
  return `${origin}/api/auth/google-start`;
}

export async function signInWithGoogleNative(): Promise<boolean> {
  const url = getGoogleLoginUrl();

  // Best-effort: try to open in system browser via App plugin
  const app = getApp();
  if (app) {
    try {
      await app.openUrl({ url });
      return true;
    } catch {
      // ignore, fall through
    }
  }

  // Best-effort: try Chrome Custom Tab
  const browser = window.Capacitor?.plugins?.Browser;
  if (browser?.open) {
    try {
      await browser.open({ url });
      return true;
    } catch {
      // ignore
    }
  }

  // Unless a plugin successfully opened the browser, return false.
  // The caller should show the URL for manual copy-paste in Chrome.
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
