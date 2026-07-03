"use client";

import * as React from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { useExercises, useProgress } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/common";
import { Label } from "@/components/ui/label";

type Range = "7d" | "30d" | "90d" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "3 mois" },
  { value: "all", label: "Tout" },
];

function filterPoints(points: { date: string }[], range: Range) {
  if (range === "all") return points;
  const cutoff =
    range === "7d" ? subDays(new Date(), 6) :
    range === "30d" ? subDays(new Date(), 29) :
    subDays(new Date(), 89);
  return points.filter((p) => parseISO(p.date) >= cutoff);
}

export function TutChart() {
  const exercisesQ = useExercises();
  const exercises = exercisesQ.data ?? [];

  // Variant 1
  const [ex1Id, setEx1Id] = React.useState("");
  const [var1Id, setVar1Id] = React.useState("");
  // Variant 2
  const [ex2Id, setEx2Id] = React.useState("");
  const [var2Id, setVar2Id] = React.useState("");

  const [range, setRange] = React.useState<Range>("30d");

  const ex1 = exercises.find((e) => e.id === ex1Id);
  const ex2 = exercises.find((e) => e.id === ex2Id);

  const var1 = var1Id || undefined;
  const var2 = var2Id || undefined;

  const progress1 = useProgress(ex1Id || undefined, var1);
  const progress2 = useProgress(ex2Id || undefined, var2);

  const p1 = progress1.data?.points ?? [];
  const p2 = progress2.data?.points ?? [];

  const data = React.useMemo(() => {
    const byDate = new Map<string, { tut1?: number; tut2?: number }>();
    for (const p of p1) {
      const d = format(parseISO(p.date), "yyyy-MM-dd");
      const entry = byDate.get(d) ?? {};
      entry.tut1 = p.totalVolume;
      byDate.set(d, entry);
    }
    for (const p of p2) {
      const d = format(parseISO(p.date), "yyyy-MM-dd");
      const entry = byDate.get(d) ?? {};
      entry.tut2 = p.totalVolume;
      byDate.set(d, entry);
    }
    return filterPoints(
      Array.from(byDate.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      range,
    );
  }, [p1, p2, range]);

  const hasEx2 = !!ex2Id;
  const hasData = data.length > 0;
  const loading = progress1.isLoading || progress2.isLoading;

  const chartConfig: ChartConfig = {
    tut1: {
      label: ex1?.name ?? "Variante 1",
      color: "var(--chart-1)",
    },
    ...(hasEx2
      ? { tut2: { label: ex2?.name ?? "Variante 2", color: "var(--chart-2)" } }
      : {}),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Temps sous tension</CardTitle>
            <CardDescription>
              Volume total (répétitions ou secondes) par séance.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Variante 1</Label>
            <div className="flex gap-2">
              <Select value={ex1Id} onValueChange={(v) => { setEx1Id(v); setVar1Id(""); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Exercice…" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ex1 && (
                <Select value={var1Id} onValueChange={setVar1Id}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Variante…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ex1.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label className="text-xs text-muted-foreground">Variante 2 (optionnel)</Label>
            <div className="flex gap-2">
              <Select
                value={ex2Id}
                onValueChange={(v) => { setEx2Id(v); setVar2Id(""); }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ex2 && (
                <Select value={var2Id} onValueChange={setVar2Id}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Variante…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ex2.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Période</Label>
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !hasData ? (
          <EmptyState
            title="Aucune donnée"
            description="Sélectionne une variante pour voir son temps sous tension dans le temps."
          />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
            <LineChart data={data} margin={{ top: 8, bottom: 8, left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d: string) => format(parseISO(d), "dd/MM")}
              />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const key = (item?.dataKey as string) ?? "tut1";
                      const is2 = key === "tut2";
                      const ex = is2 ? ex2 : ex1;
                      const color = is2 ? "var(--chart-2)" : "var(--chart-1)";
                      return (
                        <div className="flex w-full items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                          <span className="text-muted-foreground">{ex?.name ?? key}</span>
                          <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                            {Number(value).toLocaleString()}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="tut1"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              {hasEx2 && (
                <Line
                  type="monotone"
                  dataKey="tut2"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
