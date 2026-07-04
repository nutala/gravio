/**
 * Capacitor native detection via window globals (no imports — avoids bundling).
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      plugins?: Record<string, unknown>;
    };
  }
}

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return window.Capacitor?.isNativePlatform() ?? false;
}

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
