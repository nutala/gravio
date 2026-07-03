"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { parseISO, subDays } from "date-fns";
import { useExercises, useProgress } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

type Range = "7d" | "30d" | "90d" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "3 mois" },
  { value: "all", label: "Tout" },
];

function filterPoints(points: { date: string; totalVolume: number }[], range: Range) {
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

  const [ex1Id, setEx1Id] = React.useState("");
  const [var1Id, setVar1Id] = React.useState("");
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

  const total1 = React.useMemo(
    () => filterPoints(p1, range).reduce((s, p) => s + p.totalVolume, 0),
    [p1, range],
  );
  const total2 = React.useMemo(
    () => filterPoints(p2, range).reduce((s, p) => s + p.totalVolume, 0),
    [p2, range],
  );

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Volume total</CardTitle>
            <CardDescription>
              Somme des répétitions ou secondes réalisées sur une variante.
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

        {/* Volume displays */}
        <div className="grid gap-4 sm:grid-cols-2">
          <VolumeCard
            label={ex1 ? `${ex1.name}${var1Id && ex1 ? ` · ${ex1.variants.find(v => v.id === var1Id)?.name}` : ""}` : "Variante 1"}
            total={total1}
            loading={progress1.isLoading}
            range={rangeLabel}
            selected={!!ex1Id && !!var1Id}
          />
          <VolumeCard
            label={ex2 ? `${ex2.name}${var2Id && ex2 ? ` · ${ex2.variants.find(v => v.id === var2Id)?.name}` : ""}` : "Variante 2"}
            total={total2}
            loading={progress2.isLoading}
            range={rangeLabel}
            selected={!!ex2Id && !!var2Id}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function VolumeCard({
  label,
  total,
  loading,
  range,
  selected,
}: {
  label: string;
  total: number;
  loading: boolean;
  range: string;
  selected: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : !selected ? (
        <span className="text-sm text-muted-foreground">Sélectionne une variante</span>
      ) : (
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {total.toLocaleString()}
        </span>
      )}
      {selected && !loading && (
        <span className="text-[10px] text-muted-foreground">{range}</span>
      )}
    </div>
  );
}
