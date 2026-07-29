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
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const entryIds = (entries || []).map((e: any) => e.id);
  if (entryIds.length === 0) return NextResponse.json({ sets: [] });

  // Find the matching sets
  const setsQuery: any = { workoutEntryId: { in: entryIds } };
  if (variantId) setsQuery.variantId = variantId;

  const sets = await db.workoutSet.findMany({
    where: setsQuery,
    orderBy: { createdAt: "asc" },
    select: { reps: true, holdSeconds: true, weightKg: true, rpe: true, variantId: true },
  });

  return NextResponse.json({ sets });
}
