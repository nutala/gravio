"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Flame,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { type ExerciseWithVariants } from "@/lib/types";
import {
  difficultyStars,
  fmtCompact,
  fmtDate,
  metricUnit,
  relativeFromNow,
} from "@/lib/calc";
import {
  useCategoryMeta,
  useExercises,
  useOverview,
  useProgress,
  useTopExercises,
  useWorkouts,
} from "@/hooks/use-data";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import {
  EmptyState,
  SectionHeading,
  StatCard,
  StatCardSkeleton,
} from "@/components/app/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// =====================================================
// Main export
// =====================================================

export function DashboardView() {
  return (
    <div className="space-y-8">
      <FadeIn>
        <WelcomeCard />
      </FadeIn>

      <FadeIn>
        <KpiGrid />
      </FadeIn>

      <FadeIn delay={0.05}>
        <ProgressTracker />
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TopExercises />
          </div>
          <div>
            <RecentWorkouts />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="grid gap-6 lg:grid-cols-2">
          <ActivityStrip />
          <VolumeByCategory />
        </div>
      </FadeIn>
    </div>
  );
}

// =====================================================
// 0. Welcome card (auth-aware)
// =====================================================

function WelcomeCard() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Connecte-toi via le bouton en haut à droite pour synchroniser tes
            séances sur ton compte.
          </p>
        </CardContent>
      </Card>
    );
  }

  const name =
    session.user.name ?? session.user.email ?? "Athlète";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12">
          {session.user.image ? (
            <AvatarImage src={session.user.image} alt={name} />
          ) : null}
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">
            Bienvenue, {name} 👋
          </p>
          {session.user.email && (
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Animation helper
// =====================================================

function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// =====================================================
// 1. KPI Grid
// =====================================================

function KpiGrid() {
  const { data, isLoading } = useOverview();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const streakPositive = data.currentStreakDays > 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Séances totales"
        value={data.totalWorkouts}
        icon={Dumbbell}
        hint={
          data.lastWorkoutDate
            ? `Dernière : ${relativeFromNow(data.lastWorkoutDate)}`
            : "Aucune séance pour le moment"
        }
      />
      <StatCard
        label="Temps total d'entraînement"
        value={fmtCompact(data.totalMinutes)}
        unit="min"
        icon={Timer}
        hint={`${data.totalSets} séries au total`}
      />
      <StatCard
        label="Série actuelle"
        value={data.currentStreakDays}
        unit="jours"
        icon={Flame}
        accent={streakPositive ? "success" : "default"}
        hint={`Plus longue : ${data.longestStreakDays} j`}
      />
      <StatCard
        label="Cette semaine"
        value={data.thisWeekCount}
        unit="séances"
        icon={CalendarDays}
        hint={`Volume : ${fmtCompact(data.totalVolume)}`}
      />
    </div>
  );
}

// =====================================================
// 2. Progress Tracker (centerpiece)
// =====================================================

const ALL_VARIANTS = "__all__";

function ProgressTracker() {
  const exercisesQ = useExercises();
  const exercises = exercisesQ.data ?? [];

  const [ex1Id, setEx1Id] = useState<string>("");
  const [ex1VariantId, setEx1VariantId] = useState<string>(ALL_VARIANTS);
  const [ex2Id, setEx2Id] = useState<string>("");
  const [ex2VariantId, setEx2VariantId] = useState<string>(ALL_VARIANTS);

  // Default exercise 1 to the first available exercise (derived, no effect).
  const effectiveEx1Id = ex1Id || exercises[0]?.id || "";

  const ex1 = exercises.find((e) => e.id === effectiveEx1Id);
  const ex2 = exercises.find((e) => e.id === ex2Id);

  // Effective variant: only valid if it belongs to the current exercise.
  const effectiveEx1VariantId =
    ex1?.variants.some((v) => v.id === ex1VariantId)
      ? ex1VariantId
      : ALL_VARIANTS;
  const effectiveEx2VariantId =
    ex2?.variants.some((v) => v.id === ex2VariantId)
      ? ex2VariantId
      : ALL_VARIANTS;

  const progress1 = useProgress(
    effectiveEx1Id || undefined,
    effectiveEx1VariantId === ALL_VARIANTS ? null : effectiveEx1VariantId,
  );
  const progress2 = useProgress(
    ex2Id || undefined,
    effectiveEx2VariantId === ALL_VARIANTS ? null : effectiveEx2VariantId,
  );

  const points1 = progress1.data?.points;
  const points2 = progress2.data?.points;

  // Merge series by date (sorted asc).
  const mergedData = useMemo(() => {
    const p1 = points1 ?? [];
    const p2 = points2 ?? [];
    const byDate = new Map<string, { ex1?: number; ex2?: number }>();
    for (const p of p1) {
      const entry = byDate.get(p.date) ?? {};
      entry.ex1 = p.bestValue;
      byDate.set(p.date, entry);
    }
    for (const p of p2) {
      const entry = byDate.get(p.date) ?? {};
      entry.ex2 = p.bestValue;
      byDate.set(p.date, entry);
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [points1, points2]);

  const hasEx2 = !!ex2Id;
  const hasData = mergedData.length > 0;

  const chartConfig: ChartConfig = {
    ex1: {
      label: ex1?.name ?? "Exercice 1",
      color: "var(--chart-1)",
    },
    ...(hasEx2
      ? {
          ex2: {
            label: ex2?.name ?? "Exercice 2",
            color: "var(--chart-2)",
          },
        }
      : {}),
  };

  const tooltipFormatter: React.ComponentProps<
    typeof ChartTooltip
  >["formatter"] = (value, _name, item) => {
    const key = (item?.dataKey as string) ?? "ex1";
    const ex = key === "ex2" ? ex2 : ex1;
    const unit = metricUnit(ex?.isStatic ?? false);
    const color = key === "ex2" ? "var(--chart-2)" : "var(--chart-1)";
    return (
      <div className="flex w-full items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground">{ex?.name ?? key}</span>
        <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
          {Number(value).toLocaleString()}
          <span className="ml-1 font-sans text-muted-foreground">{unit}</span>
        </span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Suivi de progression</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Meilleure performance par séance dans le temps.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Control row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledSelect
            label="Exercice 1"
            value={effectiveEx1Id}
            onValueChange={(v) => {
              setEx1Id(v);
              setEx1VariantId(ALL_VARIANTS);
            }}
            placeholder="Sélectionner…"
          >
            {exercises.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </LabeledSelect>

          {ex1 && (
            <LabeledSelect
              label="Variante 1"
              value={effectiveEx1VariantId}
              onValueChange={setEx1VariantId}
            >
              <SelectItem value={ALL_VARIANTS}>Toutes les variantes</SelectItem>
              {ex1.variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </LabeledSelect>
          )}

          <LabeledSelect
            label="Exercice 2 (optionnel)"
            value={ex2Id || "__none__"}
            onValueChange={(v) => {
              setEx2Id(v === "__none__" ? "" : v);
              setEx2VariantId(ALL_VARIANTS);
            }}
          >
            <SelectItem value="__none__">Aucun</SelectItem>
            {exercises
              .filter((e) => e.id !== effectiveEx1Id)
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
          </LabeledSelect>

          {ex2 && (
            <LabeledSelect
              label="Variante 2"
              value={effectiveEx2VariantId}
              onValueChange={setEx2VariantId}
            >
              <SelectItem value={ALL_VARIANTS}>Toutes les variantes</SelectItem>
              {ex2.variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </LabeledSelect>
          )}
        </div>

        {/* Chart or empty */}
        {hasData ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[300px] w-full"
          >
            <LineChart
              data={mergedData}
              margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border/50"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(d: string) => {
                  try {
                    return format(parseISO(d), "dd MMM");
                  } catch {
                    return d;
                  }
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tickMargin={4}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={tooltipFormatter}
                    labelFormatter={(_, payload) => {
                      const dateStr = payload?.[0]?.payload?.date as
                        | string
                        | undefined;
                      if (!dateStr) return null;
                      try {
                        return (
                          <div className="font-medium">
                            {format(parseISO(dateStr), "dd MMM yyyy")}
                          </div>
                        );
                      } catch {
                        return dateStr;
                      }
                    }}
                    hideIndicator
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="ex1"
                stroke="var(--color-ex1)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-ex1)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls
              />
              {hasEx2 && (
                <Line
                  type="monotone"
                  dataKey="ex2"
                  stroke="var(--color-ex2)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: "var(--color-ex2)", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ChartContainer>
        ) : (
          <EmptyState
            icon={Activity}
            title="Pas encore de données de progression"
            description={
              ex1
                ? `Enregistre une séance avec « ${ex1.name} » pour suivre ta progression ici.`
                : "Choisis un exercice pour commencer à suivre ta progression."
            }
            className="min-h-[200px]"
          />
        )}
      </CardContent>
    </Card>
  );
}

function LabeledSelect({
  label,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

// =====================================================
// 3. Top Exercises
// =====================================================

function TopExercises() {
  const { data, isLoading } = useTopExercises();
  const exercisesMap = useExercisesMap();
  const getCatMeta = useCategoryMeta();

  return (
    <div>
      <SectionHeading
        title="Exercices favoris"
        subtitle="Exercices les plus pratiqués récemment"
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-muted/60" />
                <div className="h-3 w-1/3 rounded bg-muted/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={Trophy}
              title="Aucun exercice suivi pour le moment"
              description="Enregistre ta première séance pour voir tes exercices favoris ici."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-1">
            {data.map((te) => {
              const cat = getCatMeta(te.category);
              const ex = exercisesMap.get(te.exerciseId);
              const variant = ex?.variants.find(
                (v) => v.name === te.topVariantName,
              );
              const level = variant?.difficultyLevel ?? 0;
              return (
                <Card
                  key={te.exerciseId}
                  className="min-w-0 sm:min-w-[240px] flex-1 gap-0 p-4"
                >
                  <CardContent className="space-y-3 p-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold leading-tight">
                        {te.exerciseName}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 border-transparent text-white"
                        style={{
                          backgroundColor: cat.color,
                        }}
                      >
                        <span>{cat.emoji}</span>
                        <span className="hidden sm:inline">
                          {cat.label}
                        </span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Séances</div>
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          {te.sessions}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Meilleur ({metricUnit(te.isStatic)})
                        </div>
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          {te.bestValue}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 border-t border-border/60 pt-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Variante max</span>
                        <span className="truncate font-medium text-foreground">
                          {te.topVariantName ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Difficulté</span>
                        <span className="text-amber-500">
                          {difficultyStars(level || 3)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Dernière fois</span>
                        <span className="font-medium text-foreground">
                          {relativeFromNow(te.lastPerformed)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
    </div>
  );
}

function useExercisesMap() {
  const { data } = useExercises();
  return useMemo(() => {
    const map = new Map<string, ExerciseWithVariants>();
    data?.forEach((e) => map.set(e.id, e));
    return map;
  }, [data]);
}

// =====================================================
// 4. Recent Workouts
// =====================================================

function RecentWorkouts() {
  const { data, isLoading } = useWorkouts();
  const setView = useAppStore((s) => s.setView);

  const recent = (data ?? []).slice(0, 4);

  return (
    <div>
      <SectionHeading
        title="Séances récentes"
        subtitle="Tes dernières sessions"
      />
      <Card className="gap-0">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-md bg-muted/40"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarDays}
                title="Aucune séance pour le moment"
                description="Tes séances enregistrées apparaîtront ici."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((w) => {
                const totalSets = w.entries.reduce(
                  (acc, e) => acc + e.sets.length,
                  0,
                );
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => useAppStore.getState().setView("history")}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60 text-foreground">
                        <span className="text-[10px] uppercase leading-none text-muted-foreground">
                          {fmtDate(w.date, "MMM")}
                        </span>
                        <span className="text-sm font-bold leading-none tabular-nums">
                          {fmtDate(w.date, "dd")}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {w.title || "Séance sans titre"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{fmtDate(w.date)}</span>
                          <span aria-hidden>·</span>
                          <span className="tabular-nums">
                            {w.entries.length}{" "}
                            {w.entries.length === 1 ? "entrée" : "entrées"}
                          </span>
                          <span aria-hidden>·</span>
                          <span className="tabular-nums">{totalSets} séries</span>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {recent.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setView("history")}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Tout voir →
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 5. Activity Strip (last 30 days)
// =====================================================

function ActivityStrip() {
  const { data } = useOverview();
  const calendar = data?.activityCalendar ?? [];

  const maxVolume = useMemo(
    () => calendar.reduce((m, d) => Math.max(m, d.volume ?? 0), 0),
    [calendar],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Activité</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              30 derniers jours · volume par jour
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {calendar.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune activité pour le moment"
            description="Le volume de tes séances récentes apparaîtra ici."
          />
        ) : (
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: "repeat(30, minmax(0, 1fr))",
            }}
          >
            {calendar.map((day) => {
              const colorClass = activityColorClass(day.volume, maxVolume);
              const dateLabel = (() => {
                try {
                  return format(parseISO(day.date), "dd MMM yyyy");
                } catch {
                  return day.date;
                }
              })();
              return (
                <div
                  key={day.date}
                  className={cn(
                    "aspect-square rounded-sm transition-colors",
                    colorClass,
                  )}
                  title={`${dateLabel} · ${day.volume} volume`}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function activityColorClass(volume: number, max: number): string {
  if (!volume || volume <= 0 || max <= 0) return "bg-muted/40";
  const ratio = volume / max;
  if (ratio <= 1 / 3) return "bg-emerald-500/40";
  if (ratio <= 2 / 3) return "bg-emerald-500/70";
  return "bg-emerald-500";
}

// =====================================================
// 6. Volume by Category donut
// =====================================================

function VolumeByCategory() {
  const { data } = useOverview();
  const getCatMeta = useCategoryMeta();
  const slices = (data?.volumeByCategory ?? []).filter((s) => s.volume > 0);

  const totalVolume = slices.reduce((acc, s) => acc + s.volume, 0);

  const chartConfig: ChartConfig = {};
  for (const s of slices) {
    const meta = getCatMeta(s.category);
    chartConfig[s.category] = {
      label: meta.label,
      color: meta.color,
    };
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Volume par catégorie</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Répartition par groupes musculaires
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Pas encore de données"
            description="Enregistre des séances pour voir le volume par catégorie."
          />
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <div className="relative mx-auto h-[220px] w-full max-w-[260px]">
              <ChartContainer
                config={chartConfig}
                className="aspect-square h-full w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        nameKey="category"
                        hideLabel
                      />
                    }
                  />
                  <Pie
                    data={slices}
                    dataKey="volume"
                    nameKey="category"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {slices.map((s) => {
                      const meta = getCatMeta(s.category);
                      return (
                        <Cell
                          key={s.category}
                          fill={meta.color}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total
                </span>
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {fmtCompact(totalVolume)}
                </span>
              </div>
            </div>

            <ul className="space-y-1.5">
              {slices
                .slice()
                .sort((a, b) => b.volume - a.volume)
                .map((s) => {
                  const meta = getCatMeta(s.category);
                  const pct =
                    totalVolume > 0
                      ? Math.round((s.volume / totalVolume) * 100)
                      : 0;
                  return (
                    <li
                      key={s.category}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="flex-1 truncate text-foreground">
                        {meta.emoji} {meta.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {fmtCompact(s.volume)}
                      </span>
                      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
