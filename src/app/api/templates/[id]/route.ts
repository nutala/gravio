import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/templates/[id] — full template with entries. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const template = await db.workoutTemplate.findUnique({
    where: { id },
    include: {
      entries: {
        include: { exercise: true, variant: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }
  return NextResponse.json(template);
}

/** PATCH /api/templates/[id] — update template metadata. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  try {
    const updated = await db.workoutTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la mise à jour";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/templates/[id] */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await db.workoutTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la suppression";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT /api/templates/[id] — full update: replace entries and metadata. */
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || !body.name?.trim()) {
    return NextResponse.json({ error: "Le nom du template est obligatoire" }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      await tx.workoutTemplateEntry.deleteMany({ where: { templateId: id } });

      for (let i = 0; i < (body.entries ?? []).length; i++) {
        const e = body.entries[i];
        await tx.workoutTemplateEntry.create({
          data: {
            templateId: id,
            exerciseId: e.exerciseId,
            variantId: e.variantId || null,
            supersetGroup: typeof e.supersetGroup === "number" ? e.supersetGroup : null,
            position: i + 1,
            notes: e.notes ?? null,
            sets: Array.isArray(e.sets) ? e.sets : [],
            comboSteps: Array.isArray(e.comboSteps) ? e.comboSteps : [],
          },
        });
      }

      return tx.workoutTemplate.update({
        where: { id },
        data: { name: body.name.trim(), notes: body.notes ?? null },
        include: {
          entries: {
            include: { exercise: true, variant: true },
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la mise à jour";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
