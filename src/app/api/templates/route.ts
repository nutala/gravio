import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/templates — list templates for the current user. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const templates = await db.workoutTemplate.findMany({
    where: userId ? { userId } : { userId: null },
    include: {
      entries: {
        include: { exercise: true, variant: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(templates);
}

export interface CreateTemplateBody {
  name: string;
  notes?: string;
  entries: {
    exerciseId: string;
    variantId?: string | null;
    supersetGroup?: number | null;
    notes?: string;
    sets: {
      isHold?: boolean;
      variantId?: string | null;
      targetReps?: number;
      targetHoldSeconds?: number;
      targetWeightKg?: number;
      targetRpe?: number;
    }[];
    comboSteps?: {
      id: string;
      exerciseId: string;
      variantId?: string | null;
      mode?: string;
      reps?: number;
      holdSeconds?: number;
    }[];
  }[];
}

/** POST /api/templates — create a new template. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const body = await req.json().catch(() => null) as CreateTemplateBody | null;
  if (!body || !body.name?.trim()) {
    return NextResponse.json({ error: "Le nom du template est obligatoire" }, { status: 400 });
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "Au moins un exercice est requis" }, { status: 400 });
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const template = await tx.workoutTemplate.create({
        data: {
          id: crypto.randomUUID(),
          name: body.name.trim(),
          notes: body.notes ?? null,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      for (let i = 0; i < body.entries.length; i++) {
        const e = body.entries[i];
        await tx.workoutTemplateEntry.create({
          data: {
            id: crypto.randomUUID(),
            templateId: template.id,
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

      return tx.workoutTemplate.findUnique({
        where: { id: template.id },
        include: {
          entries: {
            include: { exercise: true, variant: true },
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de la création" },
      { status: 400 },
    );
  }
}
