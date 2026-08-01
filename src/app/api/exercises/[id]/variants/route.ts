import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** POST /api/exercises/[id]/variants — add a variant to an exercise. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const variant = await db.exerciseVariant.create({
      data: {
        id: crypto.randomUUID(),
        exerciseId: id,
        name: body.name.trim(),
        difficultyLevel: Number(body.difficultyLevel ?? 1),
        mode: body.mode === "hold" ? "hold" : "reps",
        description: body.description ?? null,
        targetValue: body.targetValue ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(variant, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add variant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
