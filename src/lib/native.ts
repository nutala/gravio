/**
 * Capacitor native helpers for Google sign-in via system browser
 * and deep link handling. Zero imports from @capacitor/web — all
 * imports are dynamic with webpackIgnore to avoid bundling.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      plugins?: Record<string, unknown>;
    };
  }
}

let _isNative: boolean | null = null;

export function isNative(): boolean {
  if (_isNative !== null) return _isNative;
  _isNative = typeof window !== "undefined" && window.Capacitor !== undefined;
  return _isNative;
}

// ── Native Google sign-in (opens system browser) ──
//
// Uses a completely server-side OAuth flow that bypasses NextAuth's
// CSRF mechanism. The state parameter is stored server-side (no CSRF
// cookie needed), so there is no cookie mismatch between WebView and
// system browser.
//
// 1. Browser.open() navigates to /api/auth/google-start
// 2. google-start generates a state, stores it server-side, redirects
//    to Google's OAuth URL
// 3. Google OAuth → callback to /api/auth/google-callback
// 4. google-callback validates state server-side, exchanges code for
//    tokens, creates/finds user, generates a one-time login code
// 5. User types the code in the app → exchange → session cookie

export async function signInWithGoogleNative(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    // Use App.openUrl() to open the system browser (not a Chrome Custom Tab)
    // because Google blocks OAuth from embedded browsers (disallowed_useragent).
    const { App } = await import(/* webpackIgnore: true */ "@capacitor/app");
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gravio.onrender.com";
    await App.openUrl({ url: origin + "/api/auth/google-start" });
    return true;
  } catch {
    return false;
  }
}

// ── Deep link / app URL open listener ──

export type UrlOpenCallback = (url: string) => void;

export async function onAppUrlOpen(cb: UrlOpenCallback): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App } = await import(/* webpackIgnore: true */ "@capacitor/app");
    const handler = await App.addListener("appUrlOpen", (data) => {
      cb(data.url);
    });
    return () => { handler.remove(); };
  } catch {
    return () => {};
  }
}

// ── Notification permission ──

export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import(
      /* webpackIgnore: true */ "@capacitor/local-notifications"
    );
    const perm = await LocalNotifications.requestPermissions();
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
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import(
      /* webpackIgnore: true */ "@capacitor/local-notifications"
    );
    await LocalNotifications.schedule({
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
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import(
      /* webpackIgnore: true */ "@capacitor/local-notifications"
    );
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch { /* ignore */ }
}

export type NativeNotificationCallback = () => void;

export async function onNativeNotificationTap(cb: NativeNotificationCallback): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { LocalNotifications } = await import(
      /* webpackIgnore: true */ "@capacitor/local-notifications"
    );
    const handler = await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      () => { cb(); },
    );
    return () => { handler.remove(); };
  } catch {
    return () => {};
  }
}
