/**
 * Global workout-draft store.
 *
 * Holds the in-progress workout so it survives view switches (e.g. checking
 * the dashboard or history mid-session, or repeating a past workout). Also
 * powers the "Repeat workout" feature via `loadFromWorkout`.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";
import type { ExerciseWithVariants, WorkoutFull, WorkoutTemplateFull, ComboStep } from "@/lib/types";

// ---------------------------------------------------------------------------
// Draft types — transient, never persisted to DB
// ---------------------------------------------------------------------------

export type DraftSet = {
  id: string;
  variantId?: string | null;
  mode?: "reps" | "hold";
  reps?: number;
  holdSeconds?: number;
  weightKg?: number;
  rpe?: number;
  /// User-confirmed completion during the live session (green check).
  validated: boolean;
};

export type DraftEntry = {
  id: string;
  exerciseId: string;
  variantId: string | null;
  notes: string;
  /// Null = standalone; a positive number groups entries into a superset.
  supersetGroup: number | null;
  sets: DraftSet[];
  // Combo-specific fields
  comboSteps: ComboStep[];
  comboWeightKg?: number;
  comboRpe?: number;
  comboValidated: boolean;
};

export type WorkoutDraft = {
  title: string;
  date: string;
  durationMin: number | "";
  exertion: number;
  bodyweight: number | "";
  notes: string;
  defaultRestSec: number;
  entries: DraftEntry[];
  sessionStartedAt: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function emptyDraft(): WorkoutDraft {
  return {
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    durationMin: "",
    exertion: 5,
    bodyweight: "",
    notes: "",
    defaultRestSec: 90,
    entries: [],
    sessionStartedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WorkoutDraftStore extends WorkoutDraft {
  setMeta: <K extends keyof WorkoutDraft>(
    key: K,
    value: WorkoutDraft[K],
  ) => void;

  addEntry: (exercise: ExerciseWithVariants) => void;
  removeEntry: (entryId: string) => void;
  updateEntry: (entryId: string, patch: Partial<DraftEntry>) => void;
  setSuperset: (entryId: string, group: number | null) => void;

  addSet: (entryId: string, defaults?: Partial<DraftSet>) => void;
  updateSet: (entryId: string, setId: string, patch: Partial<DraftSet>) => void;
  removeSet: (entryId: string, setId: string) => void;
  validateSet: (entryId: string, setId: string, validated: boolean) => void;

  // Combo methods
  addComboStep: (entryId: string, step: ComboStep) => void;
  removeComboStep: (entryId: string, stepId: string) => void;
  updateComboStep: (entryId: string, stepId: string, patch: Partial<ComboStep>) => void;
  reorderComboStep: (entryId: string, stepId: string, direction: "up" | "down") => void;
  toggleComboValidated: (entryId: string) => void;


  /// Move an entry from one index to another (drag-and-drop reorder).
  reorderEntries: (fromId: string, toId: string) => void;

  /// Start the session timer (idempotent).
  startSession: () => void;
  /// Cancel the session: clear the draft + stop the timer.
  cancelSession: () => void;

  resetDraft: () => void;

  /// Load draft from a past workout (Repeat feature). Resolves exercise
  /// objects via the provided lookup map.
  loadFromWorkout: (
    workout: WorkoutFull,
    exerciseMap: Map<string, ExerciseWithVariants>,
  ) => void;

  /// Append entries from a template to the current draft. Skips exercises
  /// that no longer exist in the catalogue.
  loadFromTemplate: (
    template: WorkoutTemplateFull,
    exerciseMap: Map<string, ExerciseWithVariants>,
  ) => void;
}

export const useDraftStore = create<WorkoutDraftStore>()(
  persist(
    (set, get) => ({
      ...emptyDraft(),

  setMeta: (key, value) => set({ [key]: value } as Partial<WorkoutDraft>),

  addEntry: (exercise) =>
    set((s) => {
      const isCombo = exercise.name === "Combos";
      return {
        entries: [
          ...s.entries,
          {
            id: uid(),
            exerciseId: exercise.id,
            variantId: null,
            notes: "",
            supersetGroup: null,
            sets: isCombo ? [] : [
              {
                id: uid(),
                validated: false,
                mode: exercise.isStatic ? "hold" : "reps",
              },
            ],
            comboSteps: [],
            comboValidated: false,
          },
        ],
      };
    }),

  removeEntry: (entryId) =>
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== entryId),
    })),

  updateEntry: (entryId, patch) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      ),
    })),

  setSuperset: (entryId, group) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, supersetGroup: group } : e,
      ),
    })),

  addSet: (entryId, defaults) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: [
                ...e.sets,
                { id: uid(), validated: false, ...defaults },
              ],
            }
          : e,
      ),
    })),

  updateSet: (entryId, setId, patch) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((st) =>
                st.id === setId ? { ...st, ...patch } : st,
              ),
            }
          : e,
      ),
    })),

  removeSet: (entryId, setId) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, sets: e.sets.filter((st) => st.id !== setId) }
          : e,
      ),
    })),

  validateSet: (entryId, setId, validated) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((st) =>
                st.id === setId ? { ...st, validated } : st,
              ),
            }
          : e,
      ),
    })),

  // ── Combo methods ──────────────────────────────────────────

  addComboStep: (entryId, step) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, comboSteps: [...e.comboSteps, step] }
          : e,
      ),
    })),

  removeComboStep: (entryId, stepId) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              comboSteps: e.comboSteps.filter((st) => st.id !== stepId),
            }
          : e,
      ),
    })),

  updateComboStep: (entryId, stepId, patch) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              comboSteps: e.comboSteps.map((st) =>
                st.id === stepId ? { ...st, ...patch } : st,
              ),
            }
          : e,
      ),
    })),

  reorderComboStep: (entryId, stepId, direction) =>
    set((s) => {
      const entry = s.entries.find((e) => e.id === entryId);
      if (!entry) return s;
      const idx = entry.comboSteps.findIndex((st) => st.id === stepId);
      if (idx === -1) return s;
      if (direction === "up" && idx === 0) return s;
      if (direction === "down" && idx === entry.comboSteps.length - 1) return s;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      const next = [...entry.comboSteps];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return {
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, comboSteps: next } : e,
        ),
      };
    }),

  toggleComboValidated: (entryId) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, comboValidated: !e.comboValidated }
          : e,
      ),
    })),

  reorderEntries: (fromId, toId) =>
    set((s) => {
      const fromIdx = s.entries.findIndex((e) => e.id === fromId);
      const toIdx = s.entries.findIndex((e) => e.id === toId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return s;
      const next = [...s.entries];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { entries: next };
    }),

  startSession: () => {
    if (get().sessionStartedAt != null) return;
    set({ sessionStartedAt: Date.now() });
  },

  cancelSession: () => set({ ...emptyDraft() }),

  resetDraft: () => set({ ...emptyDraft() }),

  loadFromWorkout: (workout, exerciseMap) => {
    const entries: DraftEntry[] = [];
    for (const e of workout.entries) {
      const ex = exerciseMap.get(e.exerciseId);
      // Skip exercises that no longer exist in the catalogue.
      if (!ex) continue;
      const rawComboSteps = (e as unknown as { comboSteps: unknown }).comboSteps;
      const comboSteps = Array.isArray(rawComboSteps) ? rawComboSteps as ComboStep[] : [];
      const isCombo = ex.name === "Combos" || comboSteps.length > 0;
      entries.push({
        id: uid(),
        exerciseId: e.exerciseId,
        variantId: e.variantId ?? null,
        notes: e.notes ?? "",
        supersetGroup: e.supersetGroup ?? null,
        sets: isCombo ? [] : e.sets.map((st) => ({
          id: uid(),
          variantId: st.variantId ?? undefined,
          reps: st.reps ?? undefined,
          holdSeconds: st.holdSeconds ?? undefined,
          weightKg: st.weightKg ?? undefined,
          rpe: st.rpe ?? undefined,
          validated: false,
        })),
        comboSteps,
        comboWeightKg: (e as unknown as { comboWeightKg: number | null }).comboWeightKg ?? undefined,
        comboRpe: (e as unknown as { comboRpe: number | null }).comboRpe ?? undefined,
        comboValidated: false,
      });
    }
    set({
      title: workout.title ? `${workout.title} (bis)` : "",
      date: format(new Date(), "yyyy-MM-dd"),
      durationMin: workout.durationMin ?? "",
      exertion: workout.perceivedExertion ?? 5,
      bodyweight: workout.bodyweightKg ?? "",
      notes: workout.notes ?? "",
      defaultRestSec: 90,
      entries,
      sessionStartedAt: get().sessionStartedAt ?? Date.now(),
    });
  },

  loadFromTemplate: (template, exerciseMap) => {
    const newEntries: DraftEntry[] = [];
    for (const e of template.entries) {
      const ex = exerciseMap.get(e.exerciseId);
      if (!ex) continue;
      const targetSets = (e.sets as Array<{
        isHold?: boolean;
        variantId?: string | null;
        targetReps?: number;
        targetHoldSeconds?: number;
        targetWeightKg?: number;
        targetRpe?: number;
      }>) ?? [];
      const rawComboSteps = (e as unknown as { comboSteps: unknown }).comboSteps;
      const templateComboSteps = Array.isArray(rawComboSteps) ? rawComboSteps as ComboStep[] : [];
      const isCombo = ex.name === "Combos" || templateComboSteps.length > 0;
      const sets: DraftSet[] = isCombo ? [] : (targetSets.length > 0
        ? targetSets.map((ts) => ({
            id: uid(),
            variantId: ts.variantId ?? undefined,
            mode: ts.isHold ? "hold" : "reps",
            reps: ts.targetReps ?? undefined,
            holdSeconds: ts.targetHoldSeconds ?? undefined,
            weightKg: ts.targetWeightKg ?? undefined,
            rpe: ts.targetRpe ?? undefined,
            validated: false,
          }))
        : [{ id: uid(), validated: false, mode: ex.isStatic ? "hold" : "reps" }]);
      newEntries.push({
        id: uid(),
        exerciseId: e.exerciseId,
        variantId: null,
        notes: e.notes ?? "",
        supersetGroup: e.supersetGroup ?? null,
        sets,
        comboSteps: templateComboSteps,
        comboValidated: false,
      });
    }
    set((s) => ({
      entries: [...s.entries, ...newEntries],
      sessionStartedAt: s.sessionStartedAt ?? Date.now(),
    }));
  },
}),
    {
      name: "calitrack-workout-draft",
      partialize: (state) => ({
        title: state.title,
        date: state.date,
        durationMin: state.durationMin,
        exertion: state.exertion,
        bodyweight: state.bodyweight,
        notes: state.notes,
        defaultRestSec: state.defaultRestSec,
        entries: state.entries,
        sessionStartedAt: state.sessionStartedAt,
      }),
    },
  ),
);

/// Selector helper: compute the next available superset group number.
export function nextSupersetGroup(entries: DraftEntry[]): number {
  const used = new Set(
    entries.map((e) => e.supersetGroup).filter((g): g is number => g != null),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/// Selector helper: get the list of currently-used superset group numbers.
export function usedSupersetGroups(entries: DraftEntry[]): number[] {
  const used = new Set(
    entries.map((e) => e.supersetGroup).filter((g): g is number => g != null),
  );
  return Array.from(used).sort((a, b) => a - b);
}
