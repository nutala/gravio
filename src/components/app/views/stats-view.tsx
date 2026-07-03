"use client";

import * as React from "react";
import {
  Flame,
  CalendarDays,
  Target,
  BarChart3,
  Award,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

import {
  type ExerciseCategory,
  type OverviewStats,
  type TopExercise,
} from "@/lib/types";
import {
  fmtCompact,
  fmtDate,
  relativeFromNow,
  metricUnit,
  difficultyStars,
} from "@/lib/calc";
import {
  useOverview,
  useTopExercises,
  useWorkouts,
  useCategoryMeta,
} from "@/hooks/use-data";
import {
  StatCard,
  StatCardSkeleton,
  SectionHeading,
  EmptyState,
} from "@/components/app/common";
import { TutChart } from "@/components/app/tut-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- chart configs ---------- */
const volumeChartConfig: ChartConfig = {
  volume: { label: "Volume", color: "var(--chart-1)" },
};

const donutChartConfig: ChartConfig = {
  sessions: { label: "Séances" },
};

const frequencyChartConfig: ChartConfig = {
  count: { label: "Séances", color: "var(--chart-1)" },
};

const trendChartConfig: ChartConfig = {
  volume: { label: "Volume", color: "var(--chart-2)" },
};

/* ---------- helpers ---------- */
function safeNum(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
}

function heatColor(volume: number, maxVol: number): string {
  if (volume <= 0) return "bg-muted/40";
  const ratio = maxVol > 0 ? volume / maxVol : 0;
  if (ratio < 0.34) return "bg-emerald-500/40";
  if (ratio < 0.67) return "bg-emerald-500/70";
  return "bg-emerald-500";
}

function hexWithAlpha(hex: string, alpha: number): string {
  // hex like #rrggbb -> rgba string with given alpha (0-1)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/* ---------- main component ---------- */
export function StatsView() {
  const overviewQ = useOverview();
  const topQ = useTopExercises();
  const workoutsQ = useWorkouts();
  const getCatMeta = useCategoryMeta();

  const overview = overviewQ.data;
  const overviewLoading = overviewQ.isLoading;

  /* 2 + 3: volume by category (with sessions) */
  const volumeByCat = React.useMemo(() => {
    if (!overview) return [];
    return overview.volumeByCategory.map((c) => {
      const cat = c.category as ExerciseCategory;
      const meta = getCatMeta(cat);
      return {
        category: c.category,
        label: meta.label,
        volume: c.volume,
        sessions: c.sessions,
        color: meta.color,
      };
    });
  }, [overview, getCatMeta]);

  /* 4: frequency data */
  const frequencyData = React.useMemo(() => {
    if (!overview) return [];
    return overview.activityCalendar.map((d) => ({
      date: d.date,
      label: fmtDate(d.date, "dd MMM"),
      count: d.count,
      volume: d.volume,
    }));
  }, [overview]);

  const totalSessions = React.useMemo(
    () => frequencyData.reduce((acc, d) => acc + d.count, 0),
    [frequencyData],
  );

  /* 5: heatmap max */
  const heatmapMax = React.useMemo(
    () =>
      overview?.activityCalendar.reduce((m, d) => Math.max(m, d.volume), 0) ??
      0,
    [overview],
  );

  /* 7: per-workout volume trend (oldest → newest) */
  const trendData = React.useMemo(() => {
    if (!workoutsQ.data) return [];
    return workoutsQ.data
      .map((w) => {
        const vol = w.entries.reduce(
          (a, e) =>
            a +
            e.sets.reduce(
              (s, set) => s + (set.reps ?? set.holdSeconds ?? 0),
              0,
            ),
          0,
        );
        return {
          date: fmtDate(w.date, "dd MMM"),
          volume: vol,
        };
      })
      .reverse(); // API returns newest-first → flip to oldest-first
  }, [workoutsQ.data]);

  /* 6: personal records (sorted by bestValue desc) */
  const topExercises = React.useMemo<TopExercise[]>(() => {
    if (!topQ.data) return [];
    return [...topQ.data].sort((a, b) => b.bestValue - a.bestValue);
  }, [topQ.data]);

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Statistiques"
        subtitle="Analyse détaillée de ton volume d'entraînement, de ta régularité et de tes records personnels."
      />

      {/* 1. Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {overviewLoading || !overview ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Cette semaine"
              value={overview.thisWeekCount}
              unit="séances"
              icon={CalendarDays}
              hint="7 derniers jours"
            />
            <StatCard
              label="Effort moyen"
              value={overview.avgExertion ?? "—"}
              unit={overview.avgExertion != null ? "/10" : undefined}
              icon={Target}
              accent="warning"
              hint="Effort perçu"
            />
          </>
        )}
      </div>

      {/* 2. Volume total par variante */}
      <TutChart />

      {/* Charts grid (2 columns on lg) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 3. Volume by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Volume par catégorie
            </CardTitle>
            <CardDescription>
              Volume total d'entraînement · 30 derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent style={{ overflowX: 'auto' }}>
            {overviewLoading || !overview ? (
              <Skeleton className="h-[260px] w-full" />
            ) : volumeByCat.length === 0 ? (
              <EmptyState
                title="Pas de données de volume"
                description="Enregistre des séances dans les 30 derniers jours pour remplir ce graphique."
              />
            ) : (
              <ChartContainer
                config={volumeChartConfig}
                className="aspect-auto h-[260px] w-full"
                style={{ display: 'block' }}
              >
                <BarChart
                  data={volumeByCat}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) => fmtCompact(Number(v))}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {String(name)}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {fmtCompact(safeNum(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                    {volumeByCat.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Category Distribution donut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Répartition par catégorie
            </CardTitle>
            <CardDescription>
              Séances par catégorie · 30 derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent style={{ overflowX: 'auto' }}>
            {overviewLoading || !overview ? (
              <Skeleton className="h-[260px] w-full" />
            ) : volumeByCat.length === 0 ? (
              <EmptyState
                title="Pas de données"
                description="Aucune séance récente à ventiler."
              />
            ) : (
              <div className="relative h-[260px]">
                <ChartContainer
                  config={donutChartConfig}
                  className="aspect-auto h-full w-full"
                  style={{ display: 'block' }}
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name) => {
                            const n = safeNum(value);
                            return (
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {String(name)}
                                </span>
                                <span className="font-mono font-medium tabular-nums">
                                  {n} séance{n === 1 ? "" : "s"}
                                </span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={volumeByCat}
                      dataKey="sessions"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {volumeByCat.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums text-foreground">
                    {totalSessions}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    séances
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Workout Frequency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Fréquence d'entraînement
            </CardTitle>
            <CardDescription>
              Nombre de séances par jour · 30 derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent style={{ overflowX: 'auto' }}>
            {overviewLoading || !overview ? (
              <Skeleton className="h-[260px] w-full" />
            ) : frequencyData.length === 0 ? (
              <EmptyState title="Pas de données" />
            ) : (
              <ChartContainer
                config={frequencyChartConfig}
                className="aspect-auto h-[260px] w-full"
                style={{ display: 'block' }}
              >
                <BarChart
                  data={frequencyData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => {
                          const n = safeNum(value);
                          return (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                {String(
                                  (item?.payload as { label?: string } | undefined)
                                    ?.label ?? "",
                                )}
                              </span>
                              <span className="font-mono font-medium tabular-nums">
                                {n} séance{n === 1 ? "" : "s"}
                              </span>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 5. Activity Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-muted-foreground" />
              Carte d'activité
            </CardTitle>
            <CardDescription>
              Intensité du volume d'entraînement · 30 derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent style={{ overflowX: 'auto' }}>
            {overviewLoading || !overview ? (
              <Skeleton className="h-[200px] w-full" />
            ) : overview.activityCalendar.length === 0 ? (
              <EmptyState title="Pas de données" />
            ) : (
              <Heatmap data={overview} maxVol={heatmapMax} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Personal Records */}
      <div>
        <SectionHeading
          title="Records personnels"
          subtitle="Exercices classés par meilleure performance sur une seule série."
          action={
            topExercises.length > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {topExercises.length} exercice{topExercises.length > 1 ? "s" : ""}
              </Badge>
            ) : undefined
          }
        />
        <Card>
          <CardContent className="p-0">
            {topQ.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : topExercises.length === 0 ? (
              <EmptyState
                icon={Award}
                title="Aucun record pour le moment"
                description="Enregistre des séances avec des séries pour remplir tes records personnels."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercice</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Séances</TableHead>
                      <TableHead className="text-right">Meilleure série</TableHead>
                      <TableHead>Variante</TableHead>
                      <TableHead className="text-right">
                        Dernière fois
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topExercises.map((ex) => {
                      const cat = ex.category as ExerciseCategory;
                      const meta = getCatMeta(cat);
                      const color = meta.color;
                      const isHex = color.startsWith("#");
                      const bgTint = isHex
                        ? hexWithAlpha(color, 0.12)
                        : `${color}1f`;
                      const borderColor = isHex
                        ? hexWithAlpha(color, 0.4)
                        : `${color}55`;
                      return (
                        <TableRow key={ex.exerciseId}>
                          <TableCell className="font-medium">
                            <span
                              className="block border-l-2 pl-3"
                              style={{ borderColor: color }}
                            >
                              {ex.exerciseName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="gap-1.5"
                              style={{
                                backgroundColor: bgTint,
                                borderColor,
                                color,
                              }}
                            >
                              {meta.emoji ? <span>{meta.emoji}</span> : null}
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ex.sessions}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-semibold tabular-nums">
                              {fmtCompact(ex.bestValue)}
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">
                              {metricUnit(ex.isStatic)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {ex.topVariantName ? (
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <span className="text-xs text-amber-500">
                                  {difficultyStars(3)}
                                </span>
                                <span className="text-sm">
                                  {ex.topVariantName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {relativeFromNow(ex.lastPerformed)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7. Volume Trend */}
      {trendData.length > 0 && (
        <div>
          <SectionHeading
            title="Tendance du volume"
            subtitle="Volume total par séance dans le temps."
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Volume par séance
              </CardTitle>
              <CardDescription>
                Somme des reps / secondes de maintien sur toutes les séries de chaque séance
              </CardDescription>
            </CardHeader>
            <CardContent style={{ overflowX: 'auto' }}>
              <ChartContainer
                config={trendChartConfig}
                className="aspect-auto h-[240px] w-full"
                style={{ display: 'block' }}
              >
                <LineChart
                  data={trendData}
                  margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) => fmtCompact(Number(v))}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {String(
                                (item?.payload as { date?: string } | undefined)
                                  ?.date ?? "",
                              )}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {fmtCompact(safeNum(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="var(--color-volume)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Heatmap sub-component ---------- */
function Heatmap({
  data,
  maxVol,
}: {
  data: OverviewStats;
  maxVol: number;
}) {
  // 30 days rendered as a 6 × 5 grid (oldest top-left → newest bottom-right).
  const cells = data.activityCalendar;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[300px] grid-cols-6 gap-1.5">
          {cells.map((d) => {
            const vol = d.volume;
            const cls = heatColor(vol, maxVol);
            const dateLabel = fmtDate(d.date, "dd MMM yyyy");
            return (
              <div
                key={d.date}
                title={`${dateLabel} · ${fmtCompact(vol)} volume · ${d.count} séance${d.count === 1 ? "" : "s"}`}
                className={`h-9 w-full rounded-[5px] transition-shadow hover:ring-2 hover:ring-ring/40 ${cls}`}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>Moins</span>
        <span className="h-3 w-3 rounded-[3px] bg-muted/40" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-500/40" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-500/70" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-500" />
        <span>Plus</span>
      </div>
    </div>
  );
}
