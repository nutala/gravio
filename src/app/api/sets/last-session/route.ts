import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const url = new URL(req.url);
  const exerciseId = url.searchParams.get("exerciseId");
  const variantId = url.searchParams.get("variantId");

  if (!exerciseId) {
    return NextResponse.json(
      { error: "exerciseId est requis" },
      { status: 400 },
    );
  }

  // Resolve workout IDs for this user (Supabase can't filter by nested relations)
  let workoutIds: string[] = [];
  if (userId) {
    const userWorkouts = await db.workout.findMany({ where: { userId }, select: { id: true } });
    workoutIds = (userWorkouts || []).map((w: any) => w.id);
  }
  if (workoutIds.length === 0) return NextResponse.json({ sets: [] });

  // Find matching workout entries
  const entries = await db.workoutEntry.findMany({
    where: { exerciseId, workoutId: { in: workoutIds } },
    select: {
      id: true,
      workoutId: true,
      workout: { select: { date: true, createdAt: true } },
    },
  });
  if (entries.length === 0) return NextResponse.json({ sets: [] });
  const entryIds = entries.map((e: any) => e.id);

  // Find the matching sets across all sessions
  const setsQuery: any = { workoutEntryId: { in: entryIds } };
  if (variantId) setsQuery.variantId = variantId;

  const allSets = await db.workoutSet.findMany({
    where: setsQuery,
    orderBy: { setNumber: "asc" },
    select: { workoutEntryId: true, reps: true, holdSeconds: true, weightKg: true, rpe: true, variantId: true },
  });

  // Group sets by their workout, then keep only the most recent session
  // where this exercise+variant was actually performed.
  const byWorkout = new Map<string, Array<typeof allSets[number]>>();
  const sortedEntries = entries.slice().sort((a: any, b: any) => {
    const da = a.workout?.date ? new Date(a.workout.date).getTime() : 0;
    const db2 = b.workout?.date ? new Date(b.workout.date).getTime() : 0;
    if (da !== db2) return db2 - da;
    const ca = a.workout?.createdAt ? new Date(a.workout.createdAt).getTime() : 0;
    const cb = b.workout?.createdAt ? new Date(b.workout.createdAt).getTime() : 0;
    return cb - ca;
  });
  for (const e of sortedEntries) {
    const sets = allSets.filter((s: any) => (s as any).workoutEntryId === e.id);
    if (sets.length > 0) {
      const existing = byWorkout.get(e.workoutId);
      if (existing) {
        existing.push(...sets);
      } else {
        byWorkout.set(e.workoutId, sets);
      }
    }
  }
  if (byWorkout.size === 0) return NextResponse.json({ sets: [] });

  // Pick the most recent workout that has matching sets
  let bestWorkoutId: string | null = null;
  for (const e of sortedEntries) {
    if (byWorkout.has(e.workoutId)) {
      bestWorkoutId = e.workoutId;
      break;
    }
  }
  if (!bestWorkoutId) return NextResponse.json({ sets: [] });

  return NextResponse.json({ sets: byWorkout.get(bestWorkoutId)! });
}
