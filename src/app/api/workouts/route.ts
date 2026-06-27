import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/workouts — list workouts for the current user (newest first). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const workouts = await db.workout.findMany({
    where: userId ? { userId } : { userId: null },
    include: {
      entries: {
        include: { exercise: true, variant: true, sets: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
  });
  return NextResponse.json(workouts);
}

/** POST /api/workouts — create a workout with nested entries and sets. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "Au moins une entrée est requise" }, { status: 400 });
  }

  for (const e of body.entries) {
    if (typeof e.exerciseId !== "string") {
      return NextResponse.json({ error: "Chaque entrée a besoin d'un exerciseId" }, { status: 400 });
    }
    if (!Array.isArray(e.sets) || e.sets.length === 0) {
      return NextResponse.json({ error: "Chaque entrée a besoin d'au moins une série" }, { status: 400 });
    }
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const workout = await tx.workout.create({
        data: {
          date: body.date ? new Date(body.date) : new Date(),
          title: body.title ?? null,
          durationMin: body.durationMin ?? null,
          perceivedExertion: body.perceivedExertion ?? null,
          bodyweightKg: body.bodyweightKg ?? null,
          notes: body.notes ?? null,
          userId,
        },
      });

      for (let i = 0; i < body.entries.length; i++) {
        const e = body.entries[i];
        const entry = await tx.workoutEntry.create({
          data: {
            workoutId: workout.id,
            exerciseId: e.exerciseId,
            variantId: e.variantId || null,
            supersetGroup: typeof e.supersetGroup === "number" ? e.supersetGroup : null,
            position: i + 1,
            notes: e.notes ?? null,
          },
        });
        await tx.workoutSet.createMany({
          data: e.sets.map(
            (s: { variantId?: string | null; reps?: number; holdSeconds?: number; weightKg?: number; rpe?: number }, j: number) => ({
              workoutEntryId: entry.id,
              setNumber: j + 1,
              variantId: s.variantId || null,
              reps: s.reps ?? null,
              holdSeconds: s.holdSeconds ?? null,
              weightKg: s.weightKg ?? null,
              rpe: s.rpe ?? null,
            }),
          ),
        });
      }

      return tx.workout.findUnique({
        where: { id: workout.id },
        include: {
          entries: {
            include: { exercise: true, variant: true, sets: { include: { variant: true } } },
            orderBy: { position: "asc" },
          },
        },
      });
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 400 });
  }
}
