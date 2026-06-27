import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeStreak } from "@/lib/calc";
import { format, subDays } from "date-fns";
import type { OverviewStats } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const workouts = await db.workout.findMany({
    where: userId ? { userId } : { userId: null },
    include: { entries: { include: { exercise: true, sets: true } } },
    orderBy: { date: "desc" },
  });

  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce((acc, w) => acc + w.entries.reduce((a, e) => a + e.sets.length, 0), 0);
  const totalVolume = workouts.reduce(
    (acc, w) => acc + w.entries.reduce((a, e) => a + e.sets.reduce((s, set) => s + (set.reps ?? set.holdSeconds ?? 0), 0), 0),
    0,
  );
  const totalMinutes = workouts.reduce((acc, w) => acc + (w.durationMin ?? 0), 0);

  const exertionValues = workouts.map((w) => w.perceivedExertion).filter((v): v is number => v != null);
  const avgExertion = exertionValues.length
    ? Math.round((exertionValues.reduce((a, b) => a + b, 0) / exertionValues.length) * 10) / 10
    : null;

  const distinctExercises = new Set(workouts.flatMap((w) => w.entries.map((e) => e.exerciseId))).size;
  const { current: currentStreakDays, longest: longestStreakDays } = computeStreak(workouts.map((w) => w.date));
  const weekStart = subDays(new Date(), 6);
  const thisWeekCount = workouts.filter((w) => w.date >= weekStart).length;
  const lastWorkoutDate = workouts[0]?.date.toISOString() ?? null;

  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentWorkouts = workouts.filter((w) => w.date >= thirtyDaysAgo);
  const catMap = new Map<string, { volume: number; sessions: Set<string> }>();
  for (const w of recentWorkouts) {
    for (const e of w.entries) {
      const cat = e.exercise.category;
      const vol = e.sets.reduce((s, set) => s + (set.reps ?? set.holdSeconds ?? 0), 0);
      const entry = catMap.get(cat) ?? { volume: 0, sessions: new Set() };
      entry.volume += vol;
      entry.sessions.add(w.id);
      catMap.set(cat, entry);
    }
  }
  const volumeByCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, volume: v.volume, sessions: v.sessions.size }))
    .sort((a, b) => b.volume - a.volume);

  const activityMap = new Map<string, { count: number; volume: number }>();
  for (let i = 29; i >= 0; i--) {
    activityMap.set(format(subDays(new Date(), i), "yyyy-MM-dd"), { count: 0, volume: 0 });
  }
  for (const w of workouts) {
    const key = format(w.date, "yyyy-MM-dd");
    const entry = activityMap.get(key);
    if (entry) {
      entry.count += 1;
      entry.volume += w.entries.reduce((a, e) => a + e.sets.reduce((s, set) => s + (set.reps ?? set.holdSeconds ?? 0), 0), 0);
    }
  }
  const activityCalendar = Array.from(activityMap.entries()).map(([date, v]) => ({ date, count: v.count, volume: v.volume }));

  const stats: OverviewStats = {
    totalWorkouts, totalSets, totalVolume, totalMinutes, currentStreakDays, longestStreakDays,
    avgExertion, distinctExercises, thisWeekCount, lastWorkoutDate,
    volumeByCategory, activityCalendar,
  };
  return NextResponse.json(stats);
}
