import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";

type Params = { params: Promise<{ id: string }> };

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

export interface ExerciseRecords {
  exercise: { id: string; name: string; category: string; isStatic: boolean; description: string | null; equipment: string | null };
  variants: VariantRecord[];
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const exercise = await db.exercise.findUnique({ where: { id } });
  if (!exercise) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

  const variants = await db.exerciseVariant.findMany({
    where: { exerciseId: id },
    orderBy: { difficultyLevel: "asc" },
  });

  const entries = await db.workoutEntry.findMany({
    where: {
      exerciseId: id,
      workout: userId ? { userId } : { userId: null },
    },
    include: {
      workout: true,
      variant: true,
      sets: { orderBy: { setNumber: "asc" } },
    },
    orderBy: { workout: { date: "desc" } },
  });

  // Also fetch combo entries and inject synthetic entries for steps
  // matching this exercise, so PRs are computed from combos too.
  const comboEntries = await db.workoutEntry.findMany({
    where: {
      exercise: { name: "Combos" },
      workout: userId ? { userId } : { userId: null },
    },
    include: { workout: true },
    orderBy: { workout: { date: "desc" } },
  });
  for (const ce of comboEntries) {
    const rawSteps = (ce as unknown as { comboSteps: unknown }).comboSteps;
    if (!Array.isArray(rawSteps)) continue;
    const steps = rawSteps as Array<Record<string, unknown>>;
    const matchingSteps = steps.filter((s) => s.exerciseId === id);
    if (matchingSteps.length === 0) continue;
    (entries as unknown as Array<Record<string, unknown>>).push({
      id: ce.id,
      workoutId: ce.workoutId,
      exerciseId: id,
      variantId: (matchingSteps[0].variantId as string) ?? null,
      supersetGroup: null,
      position: 0,
      notes: null,
      comboSteps: [],
      comboWeightKg: null,
      comboRpe: null,
      createdAt: ce.createdAt,
      workout: ce.workout,
      variant: null,
      sets: matchingSteps.map((s: Record<string, unknown>, i: number) => ({
        id: `${ce.id}-${i}`,
        workoutEntryId: ce.id,
        setNumber: i + 1,
        variantId: (s.variantId as string) ?? null,
        reps: (s.reps as number) ?? null,
        holdSeconds: (s.holdSeconds as number) ?? null,
        weightKg: (s.weightKg as number) ?? null,
        rpe: (s.rpe as number) ?? null,
        createdAt: ce.createdAt,
        variant: null,
      })),
    });
  }

  const setUnit = (s: { reps: number | null; holdSeconds: number | null }): string =>
    s.holdSeconds != null && (s.reps == null || s.reps === 0) ? "s" : "reps";

  const variantRecords: VariantRecord[] = variants.map((v) => {
    const relevantEntries = entries.filter(
      (e) =>
        e.variantId === v.id ||
        e.sets.some((s) => s.variantId === v.id),
    );

    const allSets = relevantEntries.flatMap((e) =>
      e.sets
        .filter((s) => s.variantId === v.id)
        .map((s) => ({
          ...s,
          workoutDate: e.workout.date,
          workoutId: e.workoutId,
        })),
    );

    if (allSets.length === 0) {
      return {
        variantId: v.id,
        variantName: v.name,
        targetValue: v.targetValue,
        difficultyLevel: v.difficultyLevel,
        allTimeBest: null,
        bestByWeight: [],
        recentPerformances: [],
        prHistory: [],
      };
    }

    const metric = (s: typeof allSets[number]) =>
      s.reps ?? s.holdSeconds ?? 0;

    const bestSet = allSets.reduce((a, b) => (metric(a) >= metric(b) ? a : b));

    /* Best per weight category */
    const byWeight = new Map<number, typeof allSets[number]>();
    for (const s of allSets) {
      const w = s.weightKg ?? 0;
      const existing = byWeight.get(w);
      if (!existing || metric(s) > metric(existing)) {
        byWeight.set(w, s);
      }
    }
    const bestByWeight = Array.from(byWeight.entries())
      .map(([weight, s]) => ({
        value: metric(s),
        unit: setUnit(s),
        weightKg: s.weightKg,
        rpe: s.rpe,
        date: format(s.workoutDate, "yyyy-MM-dd"),
        workoutId: s.workoutId,
      }))
      .sort((a, b) => b.value - a.value || (b.weightKg ?? 0) - (a.weightKg ?? 0));

    const recentPerfs = relevantEntries
      .filter((e) => e.sets.some((s) => s.variantId === v.id))
      .slice(0, 5)
      .map((e) => {
        const variantSets = e.sets.filter((s) => s.variantId === v.id);
        const bestInEntry = variantSets.reduce((a, b) => {
          const mA = a.reps ?? a.holdSeconds ?? 0;
          const mB = b.reps ?? b.holdSeconds ?? 0;
          return mA >= mB ? a : b;
        });
        return {
          value: metric(bestInEntry),
          unit: setUnit(bestInEntry),
          weightKg: bestInEntry.weightKg,
          rpe: bestInEntry.rpe,
          date: format(e.workout.date, "yyyy-MM-dd"),
          workoutId: e.workoutId,
        };
      });

    /* PR history: walk entries chronologically, record every new best */
    const entriesAsc = [...relevantEntries]
      .filter((e) => e.sets.some((s) => s.variantId === v.id))
      .sort((a, b) => a.workout.date.getTime() - b.workout.date.getTime());

    let previousBest = -1;
    const prHistory: typeof recentPerfs = [];
    for (const e of entriesAsc) {
      const variantSets = e.sets.filter((s) => s.variantId === v.id);
      const entryBest = variantSets.reduce((a, b) => {
        const mA = a.reps ?? a.holdSeconds ?? 0;
        const mB = b.reps ?? b.holdSeconds ?? 0;
        return mA >= mB ? a : b;
      });
      const entryVal = metric(entryBest);
      if (entryVal > previousBest) {
        previousBest = entryVal;
        prHistory.push({
          value: entryVal,
          unit: setUnit(entryBest),
          weightKg: entryBest.weightKg,
          rpe: entryBest.rpe,
          date: format(e.workout.date, "yyyy-MM-dd"),
          workoutId: e.workoutId,
        });
      }
    }

    return {
      variantId: v.id,
      variantName: v.name,
      targetValue: v.targetValue,
      difficultyLevel: v.difficultyLevel,
      allTimeBest: {
        value: metric(bestSet),
        unit: setUnit(bestSet),
        weightKg: bestSet.weightKg,
        rpe: bestSet.rpe,
        date: format(bestSet.workoutDate, "yyyy-MM-dd"),
        workoutId: bestSet.workoutId,
      },
      bestByWeight,
      recentPerformances: recentPerfs,
      prHistory: prHistory.reverse(),
    };
  });

  // If no variants exist but there are entries, build a single record for the exercise itself
  if (variantRecords.length === 0 && entries.length > 0) {
    const allSets = entries.flatMap((e) =>
      e.sets.map((s) => ({
        ...s,
        workoutDate: e.workout.date,
        workoutId: e.workoutId,
      })),
    );

    if (allSets.length > 0) {
      const metric = (s: (typeof allSets)[number]) => s.reps ?? s.holdSeconds ?? 0;
      const bestSet = allSets.reduce((a, b) => (metric(a) >= metric(b) ? a : b));

      const byWeight = new Map<number, (typeof allSets)[number]>();
      for (const s of allSets) {
        const w = s.weightKg ?? 0;
        const existing = byWeight.get(w);
        if (!existing || metric(s) > metric(existing)) byWeight.set(w, s);
      }
      const bestByWeight = Array.from(byWeight.entries())
        .map(([weight, s]) => ({
          value: metric(s), unit: setUnit(s), weightKg: s.weightKg, rpe: s.rpe,
          date: format(s.workoutDate, "yyyy-MM-dd"), workoutId: s.workoutId,
        }))
        .sort((a, b) => b.value - a.value || (b.weightKg ?? 0) - (a.weightKg ?? 0));

      const recentPerfs = entries.slice(0, 5).map((e) => {
        const bestInEntry = e.sets.reduce((a, b) => {
          const mA = a.reps ?? a.holdSeconds ?? 0;
          const mB = b.reps ?? b.holdSeconds ?? 0;
          return mA >= mB ? a : b;
        });
        return {
          value: metric(bestInEntry), unit: setUnit(bestInEntry),
          weightKg: bestInEntry.weightKg, rpe: bestInEntry.rpe,
          date: format(e.workout.date, "yyyy-MM-dd"), workoutId: e.workoutId,
        };
      });

      const entriesAsc = [...entries].sort((a, b) => a.workout.date.getTime() - b.workout.date.getTime());
      let previousBest = -1;
      const prHistory: typeof recentPerfs = [];
      for (const e of entriesAsc) {
        const entryBest = e.sets.reduce((a, b) => {
          const mA = a.reps ?? a.holdSeconds ?? 0;
          const mB = b.reps ?? b.holdSeconds ?? 0;
          return mA >= mB ? a : b;
        });
        const entryVal = metric(entryBest);
        if (entryVal > previousBest) {
          previousBest = entryVal;
          prHistory.push({
            value: entryVal, unit: setUnit(entryBest),
            weightKg: entryBest.weightKg, rpe: entryBest.rpe,
            date: format(e.workout.date, "yyyy-MM-dd"), workoutId: e.workoutId,
          });
        }
      }

      variantRecords.push({
        variantId: `__no-variant__`,
        variantName: exercise.name,
        targetValue: null,
        difficultyLevel: 0,
        allTimeBest: {
          value: metric(bestSet), unit: setUnit(bestSet),
          weightKg: bestSet.weightKg, rpe: bestSet.rpe,
          date: format(bestSet.workoutDate, "yyyy-MM-dd"),
          workoutId: bestSet.workoutId,
        },
        bestByWeight,
        recentPerformances: recentPerfs,
        prHistory: prHistory.reverse(),
      });
    }
  }

  const response: ExerciseRecords = {
    exercise: {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      isStatic: exercise.isStatic,
      description: exercise.description,
      equipment: exercise.equipment,
    },
    variants: variantRecords,
  };

  return NextResponse.json(response);
}
