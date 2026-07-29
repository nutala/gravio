import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps invalide" }, { status: 400 });

  const newName = typeof body.name === "string" ? body.name.trim() : existing.name;
  const oldName = existing.name;

  try {
    const updated = await db.$transaction(async (tx) => {
      if (newName !== oldName && newName) {
        await tx.exercise.updateMany({
          where: { category: oldName, userId: session.user.id },
          data: { category: newName },
        });
        await tx.$rpc('replace_tag', { old_name: oldName, new_name: newName });
      }
      return tx.category.update({
        where: { id },
        data: {
          name: newName || oldName,
          label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : (newName || oldName),
          color: typeof body.color === "string" ? body.color : existing.color,
          emoji: typeof body.emoji === "string" ? body.emoji : existing.emoji,
        },
      });
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const url = new URL(req.url);
  const reassignTo = url.searchParams.get("reassign") || "Push";

  try {
    await db.$transaction(async (tx) => {
      await tx.exercise.updateMany({
        where: { category: existing.name, userId: session.user.id },
        data: { category: reassignTo },
      });
      await tx.$rpc('remove_tag', { tag_name: existing.name });
      await tx.category.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 400 });
  }
}
