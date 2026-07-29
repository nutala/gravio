import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProgressPoint } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exerciseId = url.searchParams.get("exerciseId");
  if (!exerciseId) return NextResponse.json({ error: "exerciseId est requis" }, { status: 400 });
  const variantId = url.searchParams.get("variantId") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "60"), 200);

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

  // Resolve workout IDs for this user (Supabase can't filter by nested relations)
  let workoutIds: string[] = [];
  if (userId) {
    const userWorkouts = await db.workout.findMany({ where: { userId }, select: { id: true } });
    workoutIds = (userWorkouts || []).map((w: any) => w.id);
  }
  if (workoutIds.length === 0) return NextResponse.json({ exercise, points: [] });

  // Fetch candidate entries
  const entries = await db.workoutEntry.findMany({
    where: { exerciseId, workoutId: { in: workoutIds } },
    include: {
      workout: true,
      variant: true,
      sets: { include: { variant: true } },
    },
  });

  // Filter by variantId in JS (Supabase can't do nested some/or)
  const filtered = variantId
    ? entries.filter((e: any) =>
        e.variantId === variantId ||
        (e.sets || []).some((s: any) => s.variantId === variantId)
      )
    : entries;

  // Sort by workout date (desc) and take limit
  filtered.sort((a: any, b: any) => {
    const da = a.workout?.date || '';
    const db2 = b.workout?.date || '';
    return da > db2 ? -1 : da < db2 ? 1 : 0;
  });
  const sliced = filtered.slice(0, limit);

  const points: ProgressPoint[] = sliced
    .reverse()
    .map((e: any) => {
      const sets = variantId
        ? (e.sets || []).filter((s: any) => s.variantId === variantId)
        : (e.sets || []);
      if (sets.length === 0) return null;
      const bestSet = sets.reduce((best: any, s: any) => {
        const val = s.reps ?? s.holdSeconds ?? 0;
        const bestVal = best.reps ?? best.holdSeconds ?? 0;
        return val > bestVal ? s : best;
      }, sets[0]);
      const unit =
        bestSet && bestSet.holdSeconds != null && (bestSet.reps == null || bestSet.reps === 0)
          ? "s"
          : "reps";
      return {
        date: (e.workout?.date as string) || '',
        workoutId: e.workoutId,
        bestValue: Math.max(...sets.map((s: any) => s.reps ?? s.holdSeconds ?? 0)),
        totalVolume: sets.reduce((acc: number, s: any) => acc + (s.reps ?? s.holdSeconds ?? 0), 0),
        totalReps: sets.reduce((acc: number, s: any) => acc + (s.reps ?? 0), 0),
        totalHoldSeconds: sets.reduce((acc: number, s: any) => acc + (s.holdSeconds ?? 0), 0),
        setsCount: sets.length,
        rpe: (() => {
          const rpes = sets.map((s: any) => s.rpe).filter((v: any): v is number => v != null);
          return rpes.length ? Math.max(...rpes) : null;
        })(),
        unit,
        variantName: bestSet?.variant?.name ?? null,
      };
    })
    .filter((p): p is ProgressPoint => p != null);

  return NextResponse.json({ exercise, points });
}
