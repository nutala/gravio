/**
 * Domain helpers for the Calisthenics Tracker.
 */
import type {
  WorkoutEntryFull,
  WorkoutSet,
  Exercise,
  ExerciseVariant,
} from "./types";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";

/** Format a date (ISO string or Date) as a readable label. */
export function fmtDate(iso: string | Date, pattern = "dd MMM yyyy"): string {
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  return format(d, pattern, { locale: fr });
}

export function fmtDateTime(iso: string | Date): string {
  return fmtDate(iso, "dd MMM yyyy · HH:mm");
}

/** Relative "x days ago" label. */
export function relativeFromNow(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? parseISO(iso) : iso;
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} ans`;
}

/** The primary performance metric for a set: reps (dynamic) or hold seconds (static). */
export function setMetric(
  set: Pick<WorkoutSet, "reps" | "holdSeconds">,
): number {
  return set.reps ?? set.holdSeconds ?? 0;
}

/** Whether an exercise is tracked as an isometric hold. */
export function isStaticExercise(
  exercise: Pick<Exercise, "isStatic">,
): boolean {
  return exercise.isStatic;
}

/** Best (max) value across an entry's sets, using the proper metric. */
export function bestSetValue(entry: WorkoutEntryFull): number {
  if (entry.sets.length === 0) return 0;
  return Math.max(...entry.sets.map((s) => setMetric(s)));
}

/** Total volume for an entry (sum of metric across sets). */
export function entryVolume(entry: WorkoutEntryFull): number {
  return entry.sets.reduce((acc, s) => acc + setMetric(s), 0);
}

/** Volume for a single set, accounting for added weight (volume = reps * load). */
export function setLoadVolume(set: WorkoutSet): number {
  const metric = setMetric(set);
  const load = set.weightKg ?? 0;
  // For bodyweight moves with no extra weight, count 1 rep = bodyweight equivalent of 1 unit.
  // To keep numbers meaningful we just use metric * (1 + load/10) as a "load-adjusted volume".
  return metric * (1 + load / 10);
}

/** Unit label for an exercise metric. */
export function metricUnit(isStatic: boolean): string {
  return isStatic ? "s" : "reps";
}

/** Pretty label for a variant, including its difficulty rank. */
export function variantLabel(variant: ExerciseVariant | null): string {
  if (!variant) return "—";
  return variant.name;
}

/** Difficulty stars for a variant. */
export function difficultyStars(level: number): string {
  return "★".repeat(Math.min(level, 5)) + "☆".repeat(Math.max(0, 5 - level));
}

/** Compute current streak (consecutive days with at least one workout, ending today or yesterday). */
export function computeStreak(dates: (string | Date)[]): {
  current: number;
  longest: number;
} {
  if (dates.length === 0) return { current: 0, longest: 0 };
  const normalized = Array.from(
    new Set(
      dates
        .map((d) => (typeof d === "string" ? parseISO(d) : d))
        .map((d) => format(d, "yyyy-MM-dd")),
    ),
  ).sort();

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const ds of normalized) {
    if (prev === null) {
      run = 1;
    } else {
      const gap = differenceInCalendarDays(parseISO(ds), parseISO(prev));
      run = gap === 1 ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    prev = ds;
  }

  // Current streak: must include today or yesterday to count.
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );
  let current = 0;
  if (normalized.includes(today) || normalized.includes(yesterday)) {
    const last =
      normalized[normalized.length - 1] === today
        ? today
        : normalized[normalized.length - 1] === yesterday
          ? yesterday
          : null;
    if (last) {
      current = 1;
      let cursor = parseISO(last);
      for (let i = normalized.length - 2; i >= 0; i--) {
        const prevDate = parseISO(normalized[i]);
        if (differenceInCalendarDays(cursor, prevDate) === 1) {
          current += 1;
          cursor = prevDate;
        } else break;
      }
    }
  }

  return { current, longest };
}

/** Format a number compactly (e.g. 1250 -> 1.25k). */
export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** Convert kg to lb. */
export function kgToLb(kg: number): number {
  return kg * 2.20462;
}

/** Convert lb to kg. */
export function lbToKg(lb: number): number {
  return lb / 2.20462;
}

/** Format a weight value for display based on the user's preferred unit. */
export function fmtWeight(kg: number | null | undefined, unit: "kg" | "lb"): string {
  if (kg == null) return "—";
  if (unit === "lb") return `${kgToLb(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

/** Format a weight input placeholder based on unit. */
export function weightPlaceholder(unit: "kg" | "lb"): string {
  return unit === "lb" ? "ex. 155" : "ex. 70";
}

// ---------------------------------------------------------------------------
// Superset helpers
// ---------------------------------------------------------------------------

/// Distinct colors for superset groups (cycle through chart palette + extras).
const SUPERSET_COLORS = [
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#84cc16", // lime
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
];

/** Label for a superset group number (1 -> "A", 2 -> "B", ...). */
export function supersetLabel(group: number | null | undefined): string | null {
  if (group == null) return null;
  return String.fromCharCode("A".charCodeAt(0) + ((group - 1) % 26));
}

/** Hex color for a superset group number. */
export function supersetColor(group: number | null | undefined): string | null {
  if (group == null) return null;
  return SUPERSET_COLORS[(group - 1) % SUPERSET_COLORS.length];
}
