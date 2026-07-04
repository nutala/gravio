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
  _isNative = typeof window !== "undefined" && (window.Capacitor?.isNativePlatform() ?? false);
  return _isNative;
}

// ── Native Google sign-in (opens system browser) ──
//
// The entire OAuth flow runs in the system browser to avoid CSRF
// cookie mismatch between WebView and system browser (the signIn()
// helper from next-auth/react sets the CSRF cookie in the WebView,
// but the OAuth callback lands in the system browser cookie store).
//
// 1. Browser.open() navigates to /api/auth/native-init
// 2. native-init fetches a CSRF token, then auto-POSTs to NextAuth's
//    /api/auth/signin/google — all in the SYSTEM BROWSER cookie store
// 3. Google OAuth → callback → session created → native-callback page
// 4. The page displays a one-time code (and attempts a deep link)
// 5. User types the code in the app → exchange → session cookie

export async function signInWithGoogleNative(): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { Browser } = await import(/* webpackIgnore: true */ "@capacitor/browser");
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gravio.onrender.com";
    await Browser.open({ url: origin + "/api/auth/native-init" });
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
