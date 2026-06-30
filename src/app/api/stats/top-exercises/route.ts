import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TopExercise } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const entries = await db.workoutEntry.findMany({
    where: { workout: userId ? { userId } : { userId: null } },
    include: {
      exercise: { include: { variants: true } },
      variant: true,
      sets: { include: { variant: true } },
      workout: { select: { date: true } },
    },
    orderBy: { workout: { date: "desc" } },
  });

  const map = new Map<string, TopExercise & { lastDate: Date | null }>();
  for (const e of entries) {
    if (e.exercise.name === "Combos") continue;
    const existing = map.get(e.exerciseId);
    const metric = e.sets.reduce((s, set) => s + (set.reps ?? set.holdSeconds ?? 0), 0);
    const bestSet = Math.max(...e.sets.map((s) => s.reps ?? s.holdSeconds ?? 0), 0);

    // Best variant: check both the entry variant and per-set variants
    const allVariants = [
      ...(e.variant ? [e.variant] : []),
      ...e.sets.map((s) => s.variant).filter((v): v is NonNullable<typeof v> => v != null),
    ];
    const bestVariant = allVariants.reduce(
      (best, v) => (!best || v.difficultyLevel > best.difficultyLevel ? v : best),
      null as (typeof allVariants)[number] | null,
    );
    const bestVariantLevel = bestVariant?.difficultyLevel ?? 0;
    const bestVariantName = bestVariant?.name ?? null;

    if (!existing) {
      map.set(e.exerciseId, {
        exerciseId: e.exerciseId, exerciseName: e.exercise.name,
        category: e.exercise.category, isStatic: e.exercise.isStatic,
        sessions: 1, totalSets: e.sets.length, totalVolume: metric,
        bestValue: bestSet, topVariantName: bestVariantName,
        lastPerformed: e.workout.date.toISOString(), lastDate: e.workout.date,
      });
    } else {
      existing.sessions += 1;
      existing.totalSets += e.sets.length;
      existing.totalVolume += metric;
      existing.bestValue = Math.max(existing.bestValue, bestSet);
      if (e.variant && bestVariantLevel > 0) {
        const currentTopLevel = e.exercise.variants.find((v) => v.name === existing.topVariantName)?.difficultyLevel ?? 0;
        if (bestVariantLevel > currentTopLevel) existing.topVariantName = bestVariantName;
      }
      if (!existing.lastDate || e.workout.date > existing.lastDate) {
        existing.lastDate = e.workout.date;
        existing.lastPerformed = e.workout.date.toISOString();
      }
    }
  }

  const top = Array.from(map.values())
    .sort((a, b) => b.sessions - a.sessions || b.totalVolume - a.totalVolume)
    .slice(0, 8)
    .map(({ lastDate, ...rest }) => rest);
  return NextResponse.json(top satisfies TopExercise[]);
}
