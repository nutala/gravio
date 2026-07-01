import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
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

  const entries = await db.workoutEntry.findMany({
    where: {
      exerciseId,
      ...(variantId
        ? { OR: [{ variantId }, { sets: { some: { variantId } } }] }
        : {}),
      workout: userId ? { userId } : { userId: null },
    },
    include: { workout: true, variant: true, sets: { orderBy: { setNumber: "asc" } } },
    orderBy: { workout: { date: "desc" } },
    take: limit,
  });

  const points: ProgressPoint[] = entries
    .reverse()
    .map((e) => {
      const sets = variantId
        ? e.sets.filter((s) => s.variantId === variantId)
        : e.sets;
      if (sets.length === 0) return null;
      const bestSet = sets.reduce((best, s) => {
        const val = s.reps ?? s.holdSeconds ?? 0;
        const bestVal = best.reps ?? best.holdSeconds ?? 0;
        return val > bestVal ? s : best;
      }, sets[0]);
      const unit =
        bestSet && bestSet.holdSeconds != null && (bestSet.reps == null || bestSet.reps === 0)
          ? "s"
          : "reps";
      return {
        date: format(e.workout.date, "yyyy-MM-dd"),
        workoutId: e.workoutId,
        bestValue: Math.max(...sets.map((s) => s.reps ?? s.holdSeconds ?? 0)),
        totalVolume: sets.reduce((acc, s) => acc + (s.reps ?? s.holdSeconds ?? 0), 0),
        setsCount: sets.length,
        rpe: (() => {
          const rpes = sets.map((s) => s.rpe).filter((v): v is number => v != null);
          return rpes.length ? Math.max(...rpes) : null;
        })(),
        unit,
      };
    })
    .filter((p): p is ProgressPoint => p != null);

  return NextResponse.json({ exercise, points });
}
