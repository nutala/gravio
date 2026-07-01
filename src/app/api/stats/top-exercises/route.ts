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

    // Determine whether the best set used hold (static) or reps
    let bestIsStatic = e.exercise.isStatic;
    if (bestSet > 0) {
      const bestSetObj = e.sets.find((s) => (s.reps ?? s.holdSeconds ?? 0) === bestSet);
      if (bestSetObj) {
        bestIsStatic = bestSetObj.holdSeconds != null && (bestSetObj.reps == null || bestSetObj.reps === 0);
      }
    }

    // Find the variant that produced bestSet (first matching set wins)
    let bestSetVariantName: string | null = null;
    if (bestSet > 0) {
      for (const s of e.sets) {
        if ((s.reps ?? s.holdSeconds ?? 0) === bestSet) {
          bestSetVariantName = s.variant?.name ?? e.variant?.name ?? null;
          break;
        }
      }
    }

    if (!existing) {
      map.set(e.exerciseId, {
        exerciseId: e.exerciseId, exerciseName: e.exercise.name,
        category: e.exercise.category, isStatic: bestIsStatic,
        sessions: 1, totalSets: e.sets.length, totalVolume: metric,
        bestValue: bestSet, topVariantName: bestSetVariantName,
        lastPerformed: e.workout.date.toISOString(), lastDate: e.workout.date,
      });
    } else {
      existing.sessions += 1;
      existing.totalSets += e.sets.length;
      existing.totalVolume += metric;
      if (bestSet > existing.bestValue) {
        existing.bestValue = bestSet;
        existing.isStatic = bestIsStatic;
        if (bestSetVariantName) existing.topVariantName = bestSetVariantName;
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
