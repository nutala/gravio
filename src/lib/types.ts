/**
 * Shared domain types for the Calisthenics Tracker.
 * These mirror the Prisma models but are safe to import from client code.
 */
import type {
  Exercise as PrismaExercise,
  ExerciseVariant as PrismaVariant,
  Workout as PrismaWorkout,
  WorkoutEntry as PrismaEntry,
  WorkoutSet as PrismaSet,
  Category as PrismaCategory,
  WorkoutTemplate as PrismaTemplate,
  WorkoutTemplateEntry as PrismaTemplateEntry,
} from "@prisma/client";

export type ExerciseCategory = string;

export const CATEGORY_META: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  Push: { label: "Push", color: "#ef4444", emoji: "💪" },
  Pull: { label: "Pull", color: "#10b981", emoji: "🧗" },
  Legs: { label: "Legs", color: "#f59e0b", emoji: "🦵" },
  Core: { label: "Core", color: "#8b5cf6", emoji: "🔥" },
  Static: { label: "Static", color: "#06b6d4", emoji: "⚖️" },
  Skill: { label: "Skill", color: "#ec4899", emoji: "🎯" },
  Mobility: { label: "Mobility", color: "#84cc16", emoji: "🤸" },
  Combo: { label: "Combos", color: "#f97316", emoji: "🔗" },
};

export type Category = PrismaCategory;

export type Exercise = Omit<PrismaExercise, 'tags'> & { tags: string[] };
export type ExerciseVariant = PrismaVariant;
export type Workout = PrismaWorkout;
export type WorkoutEntry = PrismaEntry;
export type WorkoutSet = PrismaSet;

export type ExerciseWithVariants = Exercise & {
  variants: ExerciseVariant[];
};

export type WorkoutEntryFull = WorkoutEntry & {
  exercise: Exercise;
  variant: ExerciseVariant | null;
  sets: (WorkoutSet & { variant: ExerciseVariant | null })[];
};

export type WorkoutFull = Workout & {
  entries: WorkoutEntryFull[];
};

/// A single "best performance" data point on the progress chart.
export interface ProgressPoint {
  date: string; // ISO date
  workoutId: string;
  /// Best metric for that workout (reps for dynamic, seconds for static, optional load)
  bestValue: number;
  /// Total volume for that workout (sum across sets)
  totalVolume: number;
  setsCount: number;
  rpe: number | null;
}

export interface OverviewStats {
  totalWorkouts: number;
  totalSets: number;
  totalVolume: number; // sum of reps*sets or holdSeconds
  totalMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  avgExertion: number | null;
  distinctExercises: number;
  thisWeekCount: number;
  lastWorkoutDate: string | null;
  /// Volume per category (last 30 days)
  volumeByCategory: { category: string; volume: number; sessions: number }[];
  /// Workout count per day for the last 30 days
  activityCalendar: { date: string; count: number; volume: number }[];
}

export interface TopExercise {
  exerciseId: string;
  exerciseName: string;
  category: string;
  isStatic: boolean;
  sessions: number;
  totalSets: number;
  totalVolume: number;
  /// Best single-set performance
  bestValue: number;
  /// Best variant name (highest difficulty used)
  topVariantName: string | null;
  lastPerformed: string | null;
}

export interface VariantRecord {
  variantId: string;
  variantName: string;
  targetValue: number | null;
  difficultyLevel: number;
  allTimeBest: {
    value: number;
    unit: string;
    weightKg: number | null;
    rpe: number | null;
    date: string;
    workoutId: string;
  } | null;
  bestByWeight: {
    value: number;
    unit: string;
    weightKg: number | null;
    rpe: number | null;
    date: string;
    workoutId: string;
  }[];
  recentPerformances: {
    value: number;
    unit: string;
    weightKg: number | null;
    rpe: number | null;
    date: string;
    workoutId: string;
  }[];
  prHistory: {
    value: number;
    unit: string;
    weightKg: number | null;
    rpe: number | null;
    date: string;
    workoutId: string;
  }[];
}

/** A single target set inside a WorkoutTemplateEntry. */
export interface TemplateSetTarget {
  isHold?: boolean;
  variantId?: string | null;
  targetReps?: number;
  targetHoldSeconds?: number;
  targetWeightKg?: number;
  targetRpe?: number;
}

export type WorkoutTemplate = PrismaTemplate;
export type WorkoutTemplateEntry = PrismaTemplateEntry;

export type WorkoutTemplateFull = WorkoutTemplate & {
  entries: (WorkoutTemplateEntry & {
    exercise: Exercise;
    variant: ExerciseVariant | null;
  })[];
};

export interface ComboStep {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: string;
  isStatic: boolean;
  variantId?: string | null;
  variantName?: string | null;
  mode: "reps" | "hold";
  reps?: number;
  holdSeconds?: number;
  done?: boolean;
  failed?: boolean;
}

export interface ExerciseRecords {
  exercise: {
    id: string;
    name: string;
    category: string;
    isStatic: boolean;
    description: string | null;
    equipment: string | null;
  };
  variants: VariantRecord[];
}
