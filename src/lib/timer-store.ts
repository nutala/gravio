/**
 * Global rest-timer store.
 *
 * Uses an absolute `endsAt` timestamp so the countdown stays accurate even
 * if the tab is backgrounded (the widget recomputes remaining time from the
 * clock on each tick rather than decrementing a counter).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerState = "idle" | "running" | "paused" | "done";

interface RestTimerStore {
  state: TimerState;
  /// Epoch ms when the timer should end (set when running).
  endsAt: number | null;
  /// Remaining ms at the moment of pause (used to resume).
  remainingMs: number | null;
  /// Original duration in seconds (for the progress ring + label).
  totalSec: number;
  /// Label shown in the widget (e.g. "Rest" or "Superset rest").
  label: string;
  /// Last custom rest duration entered by the user (persisted).
  lastCustomRestSec: number;

  start: (seconds: number, label?: string) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  addTime: (seconds: number) => void;
  /// Called by the widget when the countdown reaches 0.
  complete: () => void;
  /// Dismiss the "done" banner and return to idle.
  dismiss: () => void;
  setLastCustomRestSec: (sec: number) => void;
}

export const useTimerStore = create<RestTimerStore>()(
  persist(
    (set, get) => ({
      state: "idle",
      endsAt: null,
      remainingMs: null,
      totalSec: 0,
      label: "Rest",
      lastCustomRestSec: 90,

      start: (seconds, label) =>
        set({
          state: "running",
          endsAt: Date.now() + seconds * 1000,
          remainingMs: null,
          totalSec: seconds,
          label: label ?? "Rest",
        }),

      pause: () => {
        const { endsAt, state } = get();
        if (state !== "running" || endsAt == null) return;
        const rem = Math.max(0, endsAt - Date.now());
        set({ state: "paused", remainingMs: rem, endsAt: null });
      },

      resume: () => {
        const { remainingMs, state } = get();
        if (state !== "paused" || remainingMs == null) return;
        set({
          state: "running",
          endsAt: Date.now() + remainingMs,
          remainingMs: null,
        });
      },

      skip: () =>
        set({
          state: "idle",
          endsAt: null,
          remainingMs: null,
          totalSec: 0,
        }),

      addTime: (seconds) => {
        const { state, endsAt, remainingMs } = get();
        if (state === "running" && endsAt != null) {
          set({ endsAt: endsAt + seconds * 1000, totalSec: get().totalSec + seconds });
        } else if (state === "paused" && remainingMs != null) {
          set({
            remainingMs: remainingMs + seconds * 1000,
            totalSec: get().totalSec + seconds,
          });
        }
      },

      complete: () => set({ state: "done", endsAt: null, remainingMs: null }),

      dismiss: () =>
        set({
          state: "idle",
          endsAt: null,
          remainingMs: null,
          totalSec: 0,
        }),

      setLastCustomRestSec: (sec) => set({ lastCustomRestSec: sec }),
    }),
    {
      name: "calitrack-rest-timer",
      partialize: (state) => ({
        state: state.state,
        endsAt: state.endsAt,
        remainingMs: state.remainingMs,
        totalSec: state.totalSec,
        label: state.label,
        lastCustomRestSec: state.lastCustomRestSec,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // If the timer ended while the page was closed, mark it done.
        if (state.state === "running" && state.endsAt != null && state.endsAt <= Date.now()) {
          useTimerStore.setState({ state: "done", endsAt: null, remainingMs: null });
        }
      },
    },
  ),
);

/** Preset rest durations offered in the UI (seconds). */
export const REST_PRESETS = [
  { sec: 0, label: "Aucun" },
  { sec: 30, label: "30s" },
  { sec: 60, label: "1m" },
  { sec: 90, label: "1m30" },
  { sec: 120, label: "2m" },
  { sec: 180, label: "3m" },
  { sec: 240, label: "4m" },
  { sec: 300, label: "5m" },
];
