"use client";

import * as React from "react";
import { Pause, Play, X, Plus, Minus, SkipForward, Timer } from "lucide-react";
import { useTimerStore } from "@/lib/timer-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  motion,
  AnimatePresence,
} from "framer-motion";

/** Play a short double-beep via the Web Audio API (no asset needed). */
function playBeep() {
  try {
    const AudioCtx =
      typeof window !== "undefined"
        ? (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)
        : undefined;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const beep = (start: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    };

    beep(now, 880);
    beep(now + 0.45, 1175);

    // Close the context after the beeps finish.
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    // Audio not available — silent fail.
  }
}

export function RestTimerWidget() {
  const timer = useTimerStore();
  const [now, setNow] = React.useState(Date.now());

  // Request notification permission on first mount.
  React.useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Tick every 250ms while running so the countdown stays smooth.
  React.useEffect(() => {
    if (timer.state !== "running") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer.state]);

  // Detect completion.
  React.useEffect(() => {
    if (timer.state === "running" && timer.endsAt != null) {
      const left = timer.endsAt - Date.now();
      if (left <= 0) {
        playBeep();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Repos terminé ! 💪", {
              body: "C'est reparti pour une série !",
              icon: "/favicon.ico",
              silent: true,
            });
          } catch { /* fallback silent */ }
        }
        toast.success("Rest complete — go! 💪", { duration: 4000 });
        timer.complete();
      }
    }
  }, [now, timer.state, timer.endsAt, timer]);

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
                  Dismiss
                </Button>
              ) : (
                <>
                  {timer.state === "running" ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={timer.pause}
                      aria-label="Pause rest timer"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={timer.resume}
                      aria-label="Resume rest timer"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => timer.addTime(-15)}
                    aria-label="Subtract 15 seconds"
                    title="-15s"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => timer.addTime(15)}
                    aria-label="Add 15 seconds"
                    title="+15s"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={timer.skip}
                    aria-label="Skip rest"
                    title="Skip"
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
