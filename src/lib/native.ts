/**
 * Capacitor native helpers for Google sign-in via system browser
 * and deep link handling. Zero imports from @capacitor/web — all
 * imports are dynamic with webpackIgnore to avoid bundling.
 */

import { signIn } from "next-auth/react";

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

export async function signInWithGoogleNative(): Promise<boolean> {
  if (!isNative()) return false;

  // 1. Get the OAuth URL from NextAuth
  const result = await signIn("google", { redirect: false, callbackUrl: "/api/auth/native-callback" });
  if (!result?.url) return false;

  // 2. Open in system browser
  try {
    const { Browser } = await import(/* webpackIgnore: true */ "@capacitor/browser");
    await Browser.open({ url: result.url });
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
