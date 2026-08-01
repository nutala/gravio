import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/workouts/[id] — full workout with entries and sets. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const workout = await db.workout.findUnique({
    where: { id },
    include: {
      entries: {
        include: { exercise: true, variant: true, sets: { include: { variant: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(workout);
}

/** PUT /api/workouts/[id] — full replace of entries/sets (edit mode). */
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      // Update workout metadata
      const workout = await tx.workout.update({
        where: { id },
        data: {
          ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.durationMin !== undefined
            ? { durationMin: body.durationMin }
            : {}),
          ...(body.perceivedExertion !== undefined
            ? { perceivedExertion: body.perceivedExertion }
            : {}),
          ...(body.bodyweightKg !== undefined
            ? { bodyweightKg: body.bodyweightKg }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          updatedAt: new Date(),
        },
      });

      // Delete existing entries (cascades to sets)
      await tx.workoutEntry.deleteMany({ where: { workoutId: id } });

      // Re-create entries and sets
      for (let i = 0; i < body.entries.length; i++) {
        const e = body.entries[i];
        const isCombo = Array.isArray(e.comboSteps) && e.comboSteps.length > 0;
        const entry = await tx.workoutEntry.create({
          data: {
            id: crypto.randomUUID(),
            workoutId: workout.id,
            exerciseId: e.exerciseId,
            variantId: e.variantId || null,
            supersetGroup: typeof e.supersetGroup === "number" ? e.supersetGroup : null,
            position: i + 1,
            notes: e.notes ?? null,
            comboSteps: isCombo ? e.comboSteps : [],
            comboWeightKg: isCombo ? (e.weightKg ?? null) : null,
            comboRpe: isCombo ? (e.rpe ?? null) : null,
            createdAt: new Date(),
          },
        });
        if (!isCombo) {
          await tx.workoutSet.createMany({
            data: e.sets.map(
              (s: { variantId?: string | null; reps?: number; holdSeconds?: number; weightKg?: number; rpe?: number }, j: number) => ({
                id: crypto.randomUUID(),
                workoutEntryId: entry.id,
                setNumber: j + 1,
                variantId: s.variantId || null,
                reps: s.reps ?? null,
                holdSeconds: s.holdSeconds ?? null,
                weightKg: s.weightKg ?? null,
                rpe: s.rpe ?? null,
                createdAt: new Date(),
              }),
            ),
          });
        }
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

    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PATCH /api/workouts/[id] — update workout metadata. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const updated = await db.workout.update({
      where: { id },
      data: {
        ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.durationMin !== undefined
          ? { durationMin: body.durationMin }
          : {}),
        ...(body.perceivedExertion !== undefined
          ? { perceivedExertion: body.perceivedExertion }
          : {}),
        ...(body.bodyweightKg !== undefined
          ? { bodyweightKg: body.bodyweightKg }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/workouts/[id] */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await db.workout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
