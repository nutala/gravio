"use client";

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, qk } from "@/lib/api-client";
import { toast } from "sonner";
import type {
  ExerciseWithVariants,
  WorkoutFull,
  OverviewStats,
  TopExercise,
  ProgressPoint,
  Exercise,
  Category,
} from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";

/** ----- Exercises ----- */
export function useExercises() {
  return useQuery<ExerciseWithVariants[]>({
    queryKey: qk.exercises,
    queryFn: () => api.get<ExerciseWithVariants[]>("/api/exercises"),
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Exercise> & { name: string }) =>
      api.post<ExerciseWithVariants>("/api/exercises", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      qc.invalidateQueries({ queryKey: qk.overview });
      toast.success("Exercice créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Partial<Exercise>;
    }) => api.patch<ExerciseWithVariants>(`/api/exercises/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Exercice mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/exercises/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      qc.invalidateQueries({ queryKey: qk.overview });
      qc.invalidateQueries({ queryKey: qk.topExercises });
      toast.success("Exercice supprimé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      exerciseId,
      body,
    }: {
      exerciseId: string;
      body: {
        name: string;
        difficultyLevel?: number;
        description?: string;
        targetValue?: number;
      };
    }) => api.post(`/api/exercises/${exerciseId}/variants`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Variante ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => api.patch(`/api/variants/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Variante mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/variants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Variante supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** ----- Workouts ----- */
export function useWorkouts() {
  return useQuery<WorkoutFull[]>({
    queryKey: qk.workouts,
    queryFn: () => api.get<WorkoutFull[]>("/api/workouts?limit=100"),
  });
}

export type NewWorkoutPayload = {
  date?: string;
  title?: string;
  durationMin?: number;
  perceivedExertion?: number;
  bodyweightKg?: number;
  notes?: string;
  entries: {
    exerciseId: string;
    variantId?: string | null;
    supersetGroup?: number | null;
    notes?: string;
    sets: {
      variantId?: string | null;
      reps?: number;
      holdSeconds?: number;
      weightKg?: number;
      rpe?: number;
    }[];
  }[];
};

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewWorkoutPayload) =>
      api.post<WorkoutFull>("/api/workouts", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.workouts });
      qc.invalidateQueries({ queryKey: qk.overview });
      qc.invalidateQueries({ queryKey: qk.topExercises });
      qc.invalidateQueries({ queryKey: ["stats", "progress"] });
      toast.success("Séance enregistrée 🎉");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => api.patch(`/api/workouts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.workouts });
      qc.invalidateQueries({ queryKey: qk.overview });
      toast.success("Séance mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/workouts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.workouts });
      qc.invalidateQueries({ queryKey: qk.overview });
      qc.invalidateQueries({ queryKey: qk.topExercises });
      toast.success("Séance supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** ----- Stats ----- */
export function useOverview() {
  return useQuery<OverviewStats>({
    queryKey: qk.overview,
    queryFn: () => api.get<OverviewStats>("/api/stats/overview"),
  });
}

export function useTopExercises() {
  return useQuery<TopExercise[]>({
    queryKey: qk.topExercises,
    queryFn: () => api.get<TopExercise[]>("/api/stats/top-exercises"),
  });
}

export function useProgress(exerciseId?: string, variantId?: string | null) {
  return useQuery<{
    exercise: Exercise;
    points: ProgressPoint[];
  }>({
    queryKey: qk.progress(exerciseId ?? "", variantId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (exerciseId) params.set("exerciseId", exerciseId);
      if (variantId) params.set("variantId", variantId);
      return api.get(`/api/stats/progress?${params.toString()}`);
    },
    enabled: !!exerciseId,
  });
}

/** ----- Profile ----- */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      newPassword?: string;
    }) => api.patch<{ name: string; email: string; image: string | null }>(
      "/api/user/profile",
      body,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
      toast.success("Profil mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Échec de l'upload");
      }
      return res.json() as Promise<{ image: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
      toast.success("Photo de profil mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** ----- Categories ----- */
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: qk.categories,
    queryFn: () => api.get<Category[]>("/api/categories"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      label?: string;
      color?: string;
      emoji?: string;
    }) => api.post<Category>("/api/categories", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      toast.success("Catégorie créée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => api.patch<Category>(`/api/categories/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Catégorie mise à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reassign,
    }: {
      id: string;
      reassign?: string;
    }) =>
      api.delete(
        `/api/categories/${id}${reassign ? `?reassign=${encodeURIComponent(reassign)}` : ""}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: qk.exercises });
      toast.success("Catégorie supprimée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Returns a lookup function `(categoryName) => { label, color, emoji }`
 * built from the user's dynamic categories, falling back to the static
 * CATEGORY_META, then to a neutral default.
 */
export function useCategoryMeta() {
  const { data: categories } = useCategories();
  const dynamicMap = React.useMemo(() => {
    const m = new Map<string, { label: string; color: string; emoji: string }>();
    for (const c of categories ?? []) {
      m.set(c.name, { label: c.label, color: c.color, emoji: c.emoji });
    }
    return m;
  }, [categories]);

  return React.useCallback(
    (name: string) => {
      return (
        dynamicMap.get(name) ??
        CATEGORY_META[name] ?? {
          label: name,
          color: "#9ca3af",
          emoji: "•",
        }
      );
    },
    [dynamicMap],
  );
}
