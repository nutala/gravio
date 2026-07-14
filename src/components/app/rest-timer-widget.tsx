"use client";

import * as React from "react";
import { Pause, Play, X, Plus, Minus, SkipForward, Timer } from "lucide-react";
import { useTimerStore } from "@/lib/timer-store";
import { useAppStore } from "@/lib/store";
import { playBeep } from "@/lib/sound";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  isNative,
  startForegroundTimer,
  stopNativeTimer,
  scheduleRestTimerAlarm,
  scheduleNativeTimerCountdown,
  scheduleCountdownMilestones,
  cancelAllNativeNotifications,
  nativeVibrate,
  stopNativeAlarm,
  requestNativeNotificationPermission,
  reportJsError,
  onRestTimerFinished,
  onNativeNotificationTap,
} from "@/lib/native";

let wakeLockRef: WakeLockSentinel | null = null;

async function acquireWakeLock() {
  try {
    if (wakeLockRef) return;
    wakeLockRef = await navigator.wakeLock.request("screen");
    wakeLockRef.onrelease = () => { wakeLockRef = null; };
  } catch { /* wake lock not supported */ }
}

function releaseWakeLock() {
  if (wakeLockRef) {
    wakeLockRef.release().catch(() => {});
    wakeLockRef = null;
  }
}

export function RestTimerWidget() {
  const timer = useTimerStore();
  const [now, setNow] = React.useState(Date.now());
  const doneHandled = React.useRef(false);
  const endsAtRef = React.useRef(timer.endsAt);

  React.useEffect(() => { endsAtRef.current = timer.endsAt; }, [timer.endsAt]);

  // Capture any uncaught JS error so a launch-time crash can be diagnosed
  // (toast + crash file) instead of failing silently in a loop.
  React.useEffect(() => {
    const handler = (e: Event) => {
      let msg: string;
      if (e instanceof ErrorEvent) {
        msg = `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`;
      } else if (e instanceof PromiseRejectionEvent) {
        msg = "unhandledrejection: " + String((e as PromiseRejectionEvent).reason);
      } else {
        msg = String(e);
      }
      reportJsError("JS: " + msg);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  // Schedule the reliable native alarms whenever the timer starts or its
  // target time changes (addTime / resume). A single setAlarmClock() is the
  // primary, Doze-proof wake-up; countdown notifications keep the UI visible
  // when the app is backgrounded or closed.
  React.useEffect(() => {
    if (timer.state !== "running" || timer.endsAt == null) {
      releaseWakeLock();
      return;
    }
    acquireWakeLock();
    const endsAt = timer.endsAt;
    const delay = Math.max(0, endsAt - Date.now());

    if (delay <= 0) {
      // Timer already expired (e.g. app was force-closed then reopened):
      // complete it now without (re)starting the foreground service, which
      // would otherwise spin up a crash loop on every launch.
      if (!doneHandled.current) {
        doneHandled.current = true;
        beepAndNotify();
        timer.complete();
        useAppStore.getState().triggerScrollToFirstUnvalidated();
      }
      releaseWakeLock();
      return;
    }

    if (isNative()) {
      requestNativeNotificationPermission().catch(() => {});
      // Primary: a native foreground service showing a live, lock-screen
      // countdown (Strong-app style). If it fails to start, fall back to a
      // Doze-proof setAlarmClock() + LocalNotifications countdown.
      startForegroundTimer(delay).then((started) => {
        if (useTimerStore.getState().state !== "running") return;
        if (!started) {
          scheduleRestTimerAlarm(delay);
          scheduleNativeTimerCountdown(Math.ceil(delay / 1000));
          scheduleCountdownMilestones(endsAt);
        }
      });
    } else {
      Notification.requestPermission().catch(() => {});
    }
  }, [timer.state, timer.endsAt]);

  // Cancel the native timer (foreground service + backup alarm) when the
  // timer leaves "running".
  React.useEffect(() => {
    if (timer.state === "running") return;
    if (isNative()) stopNativeTimer();
  }, [timer.state]);

  // Tick every 250ms while running for the countdown UI.
  React.useEffect(() => {
    if (timer.state !== "running") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.state]);

  // Complete the timer as soon as the clock passes endsAt. The absolute
  // setTimeout above can be throttled/delayed when the WebView is backgrounded
  // for a long time, so this guarantees the in-app UI reaches "done" (and the
  // beep fires) on the next tick after the target time — covering long rests
  // where the tab was frozen.
  React.useEffect(() => {
    if (
      timer.state === "running" &&
      timer.endsAt != null &&
      now >= timer.endsAt &&
      !doneHandled.current
    ) {
      doneHandled.current = true;
      beepAndNotify();
      timer.complete();
      useAppStore.getState().triggerScrollToFirstUnvalidated();
    }
  }, [timer.state, now]);

  // Absolute setTimeout: schedules the beep exactly at endsAt.
  // This is more reliable than setInterval because it fires once at the
  // precise target time, even if the tab is backgrounded (browsers throttle
  // repeated timers but single setTimeout for a future time is more reliable).
  React.useEffect(() => {
    if (timer.state !== "running" || timer.endsAt == null) return;
    const delay = Math.max(0, timer.endsAt - Date.now());
    const id = setTimeout(() => {
      doneHandled.current = true;
      beepAndNotify();
      timer.complete();
      useAppStore.getState().triggerScrollToFirstUnvalidated();
    }, delay);
    return () => clearTimeout(id);
  }, [timer.state, timer.endsAt]);

  // Visibility change: when user returns, check if timer expired and beep.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      const st = useTimerStore.getState();
      if (st.state === "running" && st.endsAt != null && Date.now() >= st.endsAt && !doneHandled.current) {
        doneHandled.current = true;
        beepAndNotify();
        st.complete();
        useAppStore.getState().triggerScrollToFirstUnvalidated();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Recovery after page refresh: timer persisted as "done" during hydration.
  React.useEffect(() => {
    if (timer.state === "done" && !doneHandled.current) {
      doneHandled.current = true;
      beepAndNotify();
    }
  }, [timer.state]);

  // Periodic countdown notification updates (web PWA only; on native the
  // foreground service owns the live notification).
  React.useEffect(() => {
    if (timer.state !== "running") return;
    const endsAt = endsAtRef.current;
    if (!endsAt) return;
    const nowMs = Date.now();
    const remainingMs = Math.max(0, endsAt - nowMs);
    const remainingSec = Math.ceil(remainingMs / 1000);

    if (isNative()) {
      // The native foreground service already shows the single, live,
      // lock-screen countdown notification. Do NOT also post a per-second
      // LocalNotifications countdown here — that would be a second, frozen
      // notification when the WebView is suspended with the screen locked.
      void remainingSec;
    } else if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "UPDATE_REST_TIMER",
        remainingSec,
        endsAt,
      });
    }
  }, [timer.state, now]);

  // Listen for messages from the service worker.
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "FOCUS_WORKOUT") {
        useAppStore.getState().triggerScrollToFirstUnvalidated();
        useAppStore.getState().setView("new-workout");
      }
      if (e.data?.type === "REST_TIMER_ENDED") {
        const st = useTimerStore.getState();
        if (st.state === "running" && st.endsAt != null && Date.now() >= st.endsAt && !doneHandled.current) {
          doneHandled.current = true;
          playBeep();
          nativeVibrate([200, 100, 200]);
          toast.success("Repos terminé — c'est reparti ! 💪", { duration: 4000 });
          st.complete();
        }
      }
    };
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handler);
      return () => navigator.serviceWorker.removeEventListener("message", handler);
    }
  }, []);

  // Native notification tap → focus workout session.
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (isNative()) {
      onNativeNotificationTap(() => {
        stopNativeAlarm();
        useAppStore.getState().triggerScrollToFirstUnvalidated();
        useAppStore.getState().setView("new-workout");
      }).then((fn) => { cleanup = fn; });
    }
    return () => { cleanup?.(); };
  }, []);

  // Native "timer finished" event: the foreground service / AlarmManager backup
  // fired the alarm. Complete the in-app timer immediately, even if its JS
  // timers were frozen while the app was backgrounded (long rests).
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (isNative()) {
      onRestTimerFinished(() => {
        const st = useTimerStore.getState();
        if (st.state === "running" && !doneHandled.current) {
          doneHandled.current = true;
          beepAndNotify();
          st.complete();
          useAppStore.getState().triggerScrollToFirstUnvalidated();
        }
      }).then((fn) => { cleanup = fn; });
    }
    return () => { cleanup?.(); };
  }, []);

  // Close notifications when timer returns to idle (dismissed / skipped).
  React.useEffect(() => {
    if (timer.state !== "idle") return;
    if (isNative()) {
      cancelAllNativeNotifications();
    } else if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLOSE_REST_TIMER" });
    }
  }, [timer.state]);

  // Vibrate during the last 3 seconds before the alarm.
  React.useEffect(() => {
    if (timer.state !== "running" || timer.endsAt == null) return;
    const endsAt = timer.endsAt;
    const t0 = Date.now();
    const schedule = (msBefore: number) => {
      const delay = Math.max(0, endsAt - t0 - msBefore);
      return setTimeout(() => {
        nativeVibrate(80);
      }, delay);
    };
    const timers = [schedule(3000), schedule(2000), schedule(1000)];
    return () => timers.forEach(clearTimeout);
  }, [timer.state, timer.endsAt]);

  function beepAndNotify() {
    if (isNative()) {
      // On native the foreground service / AlarmManager already produced the
      // alarm sound, vibration and notification. The JS side must NOT also
      // beep/vibrate (would double), and must NOT stop the alarm — it keeps
      // ringing until the user dismisses it (OK / skip / tap on notif).
    } else {
      playBeep();
      nativeVibrate([200, 100, 200]);

      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SHOW_NOTIFICATION" });
      } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const n = new Notification("Repos terminé ! 💪", {
            body: "C'est reparti pour une série !",
            tag: "rest-timer",
          });
          setTimeout(() => n.close(), 5000);
        } catch { /* fallback */ }
      }
    }
    toast.success("Repos terminé — c'est reparti ! 💪", { duration: 4000 });
  }

  if (timer.state === "idle") return null;

  const totalMs = timer.totalSec * 1000;
  const remainingMs =
    timer.state === "paused"
      ? (timer.remainingMs ?? 0)
      : Math.max(0, (timer.endsAt ?? 0) - now);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const isDone = timer.state === "done";

  // Circular progress geometry
  const R = 26;
  const C = 2 * Math.PI * R;
  const dash = C * progress;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border bg-card/95 p-3 pr-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85",
            isDone
              ? "border-emerald-500/60 ring-2 ring-emerald-500/30"
              : secondsLeft <= 10 && timer.state === "running"
                ? "border-amber-500/60"
                : "border-border",
          )}
        >
          {/* Circular countdown */}
          <div className="relative h-16 w-16 shrink-0">
            <svg
              className="h-16 w-16 -rotate-90"
              viewBox="0 0 64 64"
              aria-hidden
            >
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="5"
                className="stroke-muted"
              />
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`}
                className={cn(
                  "transition-[stroke-dasharray] duration-300 ease-linear",
                  isDone
                    ? "stroke-emerald-500"
                    : secondsLeft <= 10
                      ? "stroke-amber-500"
                      : "stroke-primary",
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isDone ? (
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                  Go!
                </span>
              ) : (
                <>
                  <span className="text-lg font-bold leading-none tabular-nums text-foreground">
                    {secondsLeft}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {timer.label}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              {isDone ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => { stopNativeAlarm(); timer.dismiss(); }}
                >
                  <X className="h-3.5 w-3.5" />
                  OK
                </Button>
              ) : (
                <>
                  {timer.state === "running" ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={timer.pause}
                      aria-label="Mettre le minuteur en pause"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={timer.resume}
                      aria-label="Reprendre le minuteur"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => timer.addTime(-15)}
                    aria-label="Enlever 15 secondes"
                    title="-15s"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => timer.addTime(15)}
                    aria-label="Ajouter 15 secondes"
                    title="+15s"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => { stopNativeAlarm(); timer.skip(); }}
                    aria-label="Passer le repos"
                    title="Passer"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {!isDone && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Timer className="h-3 w-3" />
                <span className="tabular-nums">
                  {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </span>
                <span className="opacity-60">/ {timer.totalSec}s</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
