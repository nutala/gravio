import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== "migrate2026") return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const data: Record<string, unknown[]> = {};

  for (const table of ["User","Category","Exercise","ExerciseVariant","WorkoutTemplate","WorkoutTemplateEntry","Workout","WorkoutEntry","WorkoutSet"]) {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    data[table] = rows as unknown[];
  }

  return NextResponse.json(data);
}
