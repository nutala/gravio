"use client";

import * as React from "react";
import { Pause, Play, X, Plus, Minus, SkipForward, Timer } from "lucide-react";
import { useTimerStore } from "@/lib/timer-store";
import { useAppStore } from "@/lib/store";
import { playBeep, ensureAudio } from "@/lib/sound";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// ── Timer tick etc. ──

export function RestTimerWidget() {
  const timer = useTimerStore();
  const [now, setNow] = React.useState(Date.now());
  /// Tracks whether the "done" event was handled during this session,
  /// so we don't double-beep after a refresh recovery.
  const doneHandled = React.useRef(false);
  const endsAtRef = React.useRef(timer.endsAt);

  // Sync ref so intervals always read the latest endsAt.
  React.useEffect(() => { endsAtRef.current = timer.endsAt; }, [timer.endsAt]);

  // Request notification permission when the timer starts running.
  React.useEffect(() => {
    if (timer.state === "running" && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [timer.state]);

  // Tick every 250ms while running so the countdown stays smooth.
  // Also refresh on visibility change so the timer catches up immediately
  // when the user returns to the tab.
  React.useEffect(() => {
    if (timer.state !== "running") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [timer.state]);

  // Send periodic countdown updates to the service worker notification.
  React.useEffect(() => {
    if (timer.state !== "running") return;
    const sendUpdate = () => {
      const endsAt = endsAtRef.current;
      if (!endsAt) return;
      if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
      const remainingMs = Math.max(0, endsAt - Date.now());
      navigator.serviceWorker.controller.postMessage({
        type: "UPDATE_REST_TIMER",
        remainingSec: Math.ceil(remainingMs / 1000),
        endsAt,
      });
    };
    sendUpdate();
    const id = setInterval(sendUpdate, 1000);
    return () => clearInterval(id);
  }, [timer.state]);

  // Listen for messages from the service worker.
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "FOCUS_WORKOUT") {
        useAppStore.getState().setView("new-workout");
      }
      if (e.data?.type === "REST_TIMER_ENDED") {
        const st = useTimerStore.getState();
        if (st.state === "running" && st.endsAt != null && Date.now() >= st.endsAt) {
          doneHandled.current = true;
          playBeep();
          try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibrate */ }
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

  // Close SW notification when timer returns to idle (dismissed / skipped).
  React.useEffect(() => {
    if (timer.state === "idle" && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLOSE_REST_TIMER" });
    }
  }, [timer.state]);

  // Detect completion (live).
  React.useEffect(() => {
    if (timer.state === "running" && timer.endsAt != null) {
      const left = timer.endsAt - Date.now();
      if (left <= 0) {
        doneHandled.current = true;
        beepAndNotify();
        timer.complete();
      }
    }
  }, [now, timer.state, timer.endsAt, timer]);

  // Recovery after page refresh: timer was persisted as "done" during hydration.
  React.useEffect(() => {
    if (timer.state === "done" && !doneHandled.current) {
      doneHandled.current = true;
      beepAndNotify();
    }
  }, [timer.state]);

  // Vibrate once per second during the last 3 seconds before the alarm.
  // Uses absolute setTimeout scheduling so it works even when the tab is
  // backgrounded (setInterval is throttled by browsers for background tabs).
  React.useEffect(() => {
    if (timer.state !== "running" || timer.endsAt == null) return;
    const endsAt = timer.endsAt;
    const now = Date.now();
    const schedule = (msBefore: number) => {
      const delay = Math.max(0, endsAt - now - msBefore);
      return setTimeout(() => {
        try { navigator.vibrate?.(80); } catch { /* no vibrate */ }
      }, delay);
    };
    const timers = [schedule(3000), schedule(2000), schedule(1000)];
    return () => timers.forEach(clearTimeout);
  }, [timer.state, timer.endsAt]);

  function beepAndNotify() {
    playBeep();
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibrate */ }
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
