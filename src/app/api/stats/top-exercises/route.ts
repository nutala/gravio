import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TopExercise } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // Step 1: get workout IDs for this user (Supabase can't filter by nested relation)
  let workoutIds: string[] = [];
  if (userId) {
    const userWorkouts = await db.workout.findMany({ where: { userId }, select: { id: true } });
    workoutIds = (userWorkouts || []).map((w: any) => w.id);
  }
  if (workoutIds.length === 0) return NextResponse.json([]);

  const entries = await db.workoutEntry.findMany({
    where: { workoutId: { in: workoutIds } },
    include: {
      exercise: { include: { variants: true } },
      variant: true,
      sets: { include: { variant: true } },
      workout: { select: { date: true } },
    },
  });

  const map = new Map<string, TopExercise & { lastDate: string | null; seenWorkouts: Set<string> }>();
  for (const e of entries) {
    if (e.exercise.name === "Combos") continue;
    const existing = map.get(e.exerciseId);
    const metric = e.sets.reduce((s, set) => s + (set.reps ?? set.holdSeconds ?? 0), 0);
    const bestSet = Math.max(...e.sets.map((s) => s.reps ?? s.holdSeconds ?? 0), 0);
    const wid = e.workoutId;
    const wDate = e.workout?.date as string | undefined;

    let bestIsStatic = e.exercise.isStatic;
    if (bestSet > 0) {
      const bestSetObj = e.sets.find((s) => (s.reps ?? s.holdSeconds ?? 0) === bestSet);
      if (bestSetObj) {
        bestIsStatic = bestSetObj.holdSeconds != null && (bestSetObj.reps == null || bestSetObj.reps === 0);
      }
    }

    let bestSetVariantName: string | null = null;
    let bestSetVariantDifficulty = 1;
    if (bestSet > 0) {
      for (const s of e.sets) {
        if ((s.reps ?? s.holdSeconds ?? 0) === bestSet) {
          bestSetVariantName = s.variant?.name ?? e.variant?.name ?? null;
          bestSetVariantDifficulty = s.variant?.difficultyLevel ?? e.variant?.difficultyLevel ?? 1;
          break;
        }
      }
    }

    if (!existing) {
      map.set(e.exerciseId, {
        exerciseId: e.exerciseId, exerciseName: e.exercise.name,
        category: e.exercise.category, isStatic: bestIsStatic,
        sessions: 1, totalSets: e.sets.length, totalVolume: metric,
        bestValue: bestSet, topVariantName: bestSetVariantName, topVariantDifficulty: bestSetVariantDifficulty,
        lastPerformed: wDate || null, lastDate: wDate || null,
        seenWorkouts: new Set([wid]),
      });
    } else {
      if (!existing.seenWorkouts.has(wid)) {
        existing.seenWorkouts.add(wid);
        existing.sessions += 1;
      }
      existing.totalSets += e.sets.length;
      existing.totalVolume += metric;
      if (bestSet > existing.bestValue) {
        existing.bestValue = bestSet;
        existing.isStatic = bestIsStatic;
        if (bestSetVariantName) {
          existing.topVariantName = bestSetVariantName;
          existing.topVariantDifficulty = bestSetVariantDifficulty;
        }
      }
      if (wDate && (!existing.lastDate || wDate > existing.lastDate)) {
        existing.lastDate = wDate;
        existing.lastPerformed = wDate;
      }
    }
  }

  const top = Array.from(map.values())
    .sort((a, b) => b.sessions - a.sessions || b.totalVolume - a.totalVolume)
    .slice(0, 8)
    .map(({ lastDate, seenWorkouts: _, ...rest }) => rest);
  return NextResponse.json(top satisfies TopExercise[]);
}
