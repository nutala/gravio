import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const entry = await db.workoutEntry.findFirst({
    where: {
      exerciseId,
      ...(variantId ? { variantId } : {}),
      workout: userId ? { userId } : { userId: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      sets: {
        orderBy: { createdAt: "asc" },
        select: {
          reps: true,
          holdSeconds: true,
          weightKg: true,
          rpe: true,
          variantId: true,
        },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ sets: [] });
  }

  return NextResponse.json({ sets: entry.sets });
}
