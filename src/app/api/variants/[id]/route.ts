import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/variants/[id] */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const updated = await db.exerciseVariant.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.difficultyLevel !== undefined
          ? { difficultyLevel: Number(body.difficultyLevel) }
          : {}),
        ...(body.mode !== undefined
          ? { mode: body.mode === "hold" ? "hold" : "reps" }
          : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.targetValue !== undefined
          ? { targetValue: body.targetValue }
          : {}),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/variants/[id] */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await db.exerciseVariant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
