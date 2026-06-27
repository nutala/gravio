import { NextResponse } from "next/server";
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
