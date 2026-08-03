import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Deletes the authenticated user's account and all associated data.
 * Cascade deletes are enforced by foreign-key constraints on the relations
 * between User and its categories, exercises, workouts and templates.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = session.user.id;

    // Delete in explicit ownership order, then remove cascading dependencies
    // by deleting the owning user last. Workout entries/sets and template
    // entries are removed via cascade when their parents are deleted.
    await db.workout.deleteMany({ where: { userId } });
    await db.template.deleteMany({ where: { userId } });
    await db.category.deleteMany({ where: { userId } });
    await db.exercise.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete-account]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}