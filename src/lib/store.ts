import { create } from "zustand";
import type { WorkoutFull } from "@/lib/types";

export type ViewId =
  | "dashboard"
  | "exercises"
  | "new-workout"
  | "history"
  | "stats"
  | "profile"
  | "settings"
  | "exercise-detail"
  | "templates"
  | "template-editor";

interface AppState {
  view: ViewId;
  setView: (v: ViewId) => void;
  goNewWorkout: () => void;

  repeatWorkoutId: string | null;
  repeatWorkout: (w: WorkoutFull) => void;
  consumeRepeat: () => string | null;

  editWorkoutId: string | null;
  editWorkout: (w: WorkoutFull) => void;
  consumeEdit: () => string | null;

  exerciseDetailId: string | null;
  viewExerciseDetail: (id: string) => void;

  templateEditorId: string | null;
  viewTemplateEditor: (id?: string) => void;
  closeTemplateEditor: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  setView: (v) => set({ view: v }),
  goNewWorkout: () => set({ view: "new-workout" }),

  repeatWorkoutId: null,
  repeatWorkout: (w) =>
    set({ repeatWorkoutId: w.id, view: "new-workout" }),
  consumeRepeat: () => {
    const id = useAppStore.getState().repeatWorkoutId;
    if (id) set({ repeatWorkoutId: null });
    return id;
  },

  editWorkoutId: null,
  editWorkout: (w) =>
    set({ editWorkoutId: w.id, view: "new-workout" }),
  consumeEdit: () => {
    const id = useAppStore.getState().editWorkoutId;
    if (id) set({ editWorkoutId: null });
    return id;
  },

  exerciseDetailId: null,
  viewExerciseDetail: (id) =>
    set({ exerciseDetailId: id, view: "exercise-detail" }),

  templateEditorId: null,
  viewTemplateEditor: (id) =>
    set({ templateEditorId: id ?? null, view: "template-editor" }),
  closeTemplateEditor: () =>
    set({ templateEditorId: null, view: "templates" }),
}));
