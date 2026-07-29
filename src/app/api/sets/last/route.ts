import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/sets/last?exerciseId=X&variantId=Y
 *
 * Returns the most recently performed WorkoutSet for the given exercise
 * and variant, or null if none exists.
 */
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

  // Resolve the user's workout IDs (Supabase can't filter by nested relations)
  let workoutEntryIds: string[] = [];
  if (userId) {
    const userWorkouts = await db.workout.findMany({ where: { userId }, select: { id: true } });
    const wids = (userWorkouts || []).map((w: any) => w.id);
    if (wids.length > 0) {
      const entries = await db.workoutEntry.findMany({
        where: { exerciseId, workoutId: { in: wids } },
        select: { id: true },
      });
      workoutEntryIds = (entries || []).map((e: any) => e.id);
    }
  }
  if (workoutEntryIds.length === 0) return NextResponse.json(null);

  const set = await db.workoutSet.findFirst({
    where: {
      variantId: variantId || null,
      workoutEntryId: { in: workoutEntryIds },
    },
    orderBy: { createdAt: "desc" },
    select: {
      reps: true,
      holdSeconds: true,
      weightKg: true,
      rpe: true,
      createdAt: true,
    },
  });

  return NextResponse.json(set);
}
