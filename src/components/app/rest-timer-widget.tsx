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
  stopForegroundTimer,
  scheduleRestTimerAlarm,
  cancelRestTimerAlarm,
  scheduleNativeTimerCountdown,
  cancelAllNativeNotifications,
  nativeVibrate,
  requestNativeNotificationPermission,
  onNativeNotificationTap,
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from "@/lib/native";

let wakeLockRef: WakeLockSentinel | null = null;
let batteryOptPrompted = false;

// On Samsung/Xiaomi/etc. the OS puts the app to sleep in background,
// killing the foreground service and blocking alarms. Ask the user once
// per app launch to exempt the app from battery optimization.
async function ensureBatteryExemption() {
  if (batteryOptPrompted) return;
  batteryOptPrompted = true;
  try {
    const alreadyOk = await isIgnoringBatteryOptimizations();
    if (alreadyOk) return;
    toast.info("Autorise Gravio à fonctionner en arrière-plan pour que le chrono sonne écran verrouillé.", {
      duration: 6000,
    });
    await requestIgnoreBatteryOptimizations();
  } catch { /* ignore */ }
}

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

  // Native foreground service (primary) + AlarmManager backup
  React.useEffect(() => {
    if (timer.state !== "running" || timer.endsAt == null) {
      releaseWakeLock();
      if (isNative()) stopForegroundTimer();
      return;
    }
    acquireWakeLock();
    if (isNative()) {
      requestNativeNotificationPermission().then(() => {
        ensureBatteryExemption();
        const endsAt = timer.endsAt!;
        const delay = Math.max(0, endsAt - Date.now());
        startForegroundTimer(delay);
        scheduleNativeTimerCountdown(Math.ceil(delay / 1000));
        // Backup: AlarmManager.setAlarmClock() in case service is killed
        scheduleRestTimerAlarm(delay);
      });
    } else {
      Notification.requestPermission().catch(() => {});
    }
  }, [timer.state]);

  // Cancel foreground + alarm when timer leaves "running"
  React.useEffect(() => {
    if (timer.state === "running") return;
    if (isNative()) {
      stopForegroundTimer();
      cancelRestTimerAlarm();
    }
  }, [timer.state]);

  // Tick every 250ms while running for the countdown UI.
  React.useEffect(() => {
    if (timer.state !== "running") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.state]);

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

  // Periodic countdown notification updates (throttled).
  const lastNotifUpdateRef = React.useRef(0);
  React.useEffect(() => {
    if (timer.state !== "running") return;
    const endsAt = endsAtRef.current;
    if (!endsAt) return;
    const nowMs = Date.now();
    const remainingMs = Math.max(0, endsAt - nowMs);
    const remainingSec = Math.ceil(remainingMs / 1000);

    if (isNative()) {
      const throttle = remainingSec <= 10 ? 1000 : 5000;
      if (nowMs - lastNotifUpdateRef.current >= throttle) {
        lastNotifUpdateRef.current = nowMs;
        scheduleNativeTimerCountdown(remainingSec);
      }
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
        useAppStore.getState().triggerScrollToFirstUnvalidated();
        useAppStore.getState().setView("new-workout");
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
                  onClick={timer.dismiss}
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
                    onClick={timer.skip}
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
