/**
 * Capacitor native helpers for Google sign-in via system browser
 * and deep link handling.
 *
 * Reads from window.Capacitor.Plugins directly instead of static
 * imports to avoid bundling native-only modules on web.
 *
 * Static imports from @capgo/capacitor-social-login cause runtime
 * errors on web because registerPlugin() evaluates during module
 * init.  Reading from window.Capacitor.Plugins.SocialLogin is the
 * safest pattern — it is only defined on native Capacitor builds.
 *
 * NOTE: Capacitor stores plugins under Plugins (capital P), not
 * plugins.  window.Capacitor.Plugins is the correct key.
 */

interface CapacitorPluginApp {
  addListener: (event: string, handler: (data: { url: string }) => void) => { remove: () => void };
}

interface CapacitorPluginLocalNotifications {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (opts: { notifications: Array<{ title: string; body: string; id: number; schedule?: { at: Date; allowWhileIdle?: boolean }; sound?: string; vibrate?: boolean; ongoing?: boolean; smallIcon?: string; iconColor?: string }> }) => Promise<void>;
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
      Plugins?: CapacitorPlugins;
    };
  }
}

export function isNative(): boolean {
  return typeof window !== "undefined" && window.Capacitor !== undefined;
}

function getApp(): CapacitorPluginApp | undefined {
  return window.Capacitor?.Plugins?.App;
}

function getLN(): CapacitorPluginLocalNotifications | undefined {
  return window.Capacitor?.Plugins?.LocalNotifications;
}

// ── Native Google sign-in (Chrome Custom Tab) ──
//
// Uses a completely server-side OAuth flow that bypasses NextAuth's
// CSRF mechanism. The state parameter is stored server-side (no CSRF
// cookie needed), so there is no cookie mismatch between WebView and
// system browser.
//
// 1. Browser.open() opens /api/auth/google-start in Chrome Custom Tab
// 2. google-start generates a state, stores it server-side, 302-redirects
//    to Google's OAuth URL
// 3. Google OAuth → callback to /api/auth/google-callback
// 4. google-callback validates state server-side, exchanges code for
//    tokens, creates/finds user, generates a one-time login code
// 5. User types the code in the app → exchange → session cookie

export function diagnoseCapacitor(): string {
  const parts: string[] = [];
  parts.push("Capacitor: " + (typeof window.Capacitor !== "undefined" ? "OK" : "MANQUANT"));
  parts.push("Plugins: " + (window.Capacitor?.Plugins ? "OK" : "MANQUANT"));
  parts.push("App plugin: " + (window.Capacitor?.Plugins?.App ? "OK" : "MANQUANT"));
  parts.push("LN plugin: " + (window.Capacitor?.Plugins?.LocalNotifications ? "OK" : "MANQUANT"));
  parts.push("Browser plugin: " + (window.Capacitor?.Plugins?.Browser ? "OK" : "MANQUANT"));
  parts.push("SocialLogin plugin: " + (window.Capacitor?.Plugins?.SocialLogin ? "OK" : "MANQUANT"));
  parts.push("Origin: " + window.location.origin);
  return parts.join(" | ");
}

function getSocialLogin(): CapacitorPluginSocialLogin {
  const sl = window.Capacitor?.Plugins?.SocialLogin;
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
  // Pass origin explicitly to google-start so the server doesn't have
  // to derive it from req.url (which may be an internal proxy URL).
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gravio.onrender.com";
  return `${origin}/api/auth/google-start?origin=${encodeURIComponent(origin)}`;
}

export async function signInWithGoogleNative(): Promise<boolean> {
  const url = getGoogleLoginUrl();

  // Open URL in system browser via @capacitor/browser (Chrome Custom Tab).
  // This bypasses the Google OAuth WebView block (disallowed_useragent).
  const browser = window.Capacitor?.Plugins?.Browser;
  if (browser?.open) {
    try {
      await browser.open({ url });
      return true;
    } catch {
      // ignore
    }
  }

  // Fallback: the caller should show the URL for manual copy-paste.
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

const TIMER_ALARM_ID = 1001;
const TIMER_COUNTDOWN_ID = 1002;

export async function scheduleNativeTimerAlarm(delayMs: number): Promise<boolean> {
  try {
    const ln = getLN();
    if (!ln) return false;
    await ln.schedule({
      notifications: [
        {
          id: TIMER_ALARM_ID,
          title: "⏱ Repos terminé ! 💪",
          body: "C'est reparti pour une serie !",
          schedule: { at: new Date(Date.now() + delayMs), allowWhileIdle: true },
          vibrate: true,
          smallIcon: "ic_stat_icon",
          iconColor: "#10b981",
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleNativeTimerCountdown(remainingSec: number): Promise<void> {
  try {
    const ln = getLN();
    if (!ln) return;
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    await ln.cancel({ notifications: [{ id: TIMER_COUNTDOWN_ID }] });
    await ln.schedule({
      notifications: [
        {
          id: TIMER_COUNTDOWN_ID,
          title: "⏱ " + timeStr,
          body: "Temps restant : " + timeStr,
          vibrate: false,
          smallIcon: "ic_stat_icon",
          iconColor: "#10b981",
        },
      ],
    });
  } catch { /* ignore */ }
}

export async function showNativeTimerEndNotification(): Promise<void> {
  try {
    const ln = getLN();
    if (!ln) return;
    await ln.schedule({
      notifications: [
        {
          id: TIMER_COUNTDOWN_ID,
          title: "⏱ Repos terminé ! 💪",
          body: "C'est reparti pour une serie !",
          vibrate: true,
          ongoing: false,
          smallIcon: "ic_stat_icon",
          iconColor: "#10b981",
        },
      ],
    });
  } catch { /* ignore */ }
}

export async function cancelAllNativeNotifications(): Promise<void> {
  try {
    const ln = getLN();
    if (!ln) return;
    await ln.cancel({
      notifications: [
        { id: TIMER_ALARM_ID },
        { id: TIMER_COUNTDOWN_ID },
      ],
    });
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

export async function nativeVibrate(pattern: number[] | number): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch { /* no vibrate */ }
}
