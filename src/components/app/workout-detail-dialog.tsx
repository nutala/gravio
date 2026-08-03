"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkout } from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import { useCategoryMeta } from "@/hooks/use-data";
import { entryUnit, setMetric, supersetLabel, supersetColor, fmtCompact } from "@/lib/calc";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  Timer,
  Gauge,
  Dumbbell,
  Layers,
  Activity,
  RefreshCw,
  Link2,
} from "lucide-react";
import type { WorkoutEntryFull, ExerciseCategory } from "@/lib/types";

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

interface WorkoutDetailDialogProps {
  workoutId: string | null;
  onClose: () => void;
}

export function WorkoutDetailDialog({ workoutId, onClose }: WorkoutDetailDialogProps) {
  const { data: workout, isLoading } = useWorkout(workoutId);
  const repeatWorkout = useAppStore((s) => s.repeatWorkout);

  if (!workoutId) return null;

  return (
    <Dialog open={!!workoutId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : workout ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                {workout.title?.trim() || "Séance sans titre"}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(toDate(workout.date), "EEEE d MMMM yyyy", { locale: fr })}
                </span>
                {workout.durationMin != null && (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    {workout.durationMin} min
                  </span>
                )}
                {workout.perceivedExertion != null && workout.perceivedExertion > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" />
                    RPE {workout.perceivedExertion}
                  </span>
                )}
                {workout.bodyweightKg != null && (
                  <span>BW {workout.bodyweightKg} kg</span>
                )}
              </DialogDescription>
            </>
          ) : null}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : workout ? (
          <div className="space-y-4">
            {/* Notes */}
            {workout.notes?.trim() && (
              <div className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                “{workout.notes.trim()}”
              </div>
            )}

            {/* Entries */}
            <div className="space-y-2">
              {workout.entries.map((entry) => (
                <DialogEntryDetail key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Repeat button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
              <Button onClick={() => { repeatWorkout(workout); onClose(); }}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refaire la séance
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogEntryDetail({ entry }: { entry: WorkoutEntryFull }) {
  const getCatMeta = useCategoryMeta();
  const meta = getCatMeta(entry.exercise.category as ExerciseCategory);
  const unit = entryUnit(entry);
  const totalSets = entry.sets.length;
  const totalVol = entry.sets.reduce((a, s) => a + setMetric(s), 0);
  const best = entry.sets.reduce((m, s) => Math.max(m, setMetric(s)), 0);
  const ssLabel = supersetLabel(entry.supersetGroup);
  const ssColor = supersetColor(entry.supersetGroup);
  const inSuperset = entry.supersetGroup != null;

  return (
    <div
      className="rounded-md border border-border/60 p-3"
      style={
        inSuperset && ssColor
          ? { borderLeftColor: ssColor, borderLeftWidth: 3 }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {entry.exercise.name}
        </span>
        <Badge
          variant="outline"
          className="border-transparent text-[10px] font-semibold"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          {meta.label}
        </Badge>
        {inSuperset && ssColor && ssLabel && (
          <Badge
            variant="outline"
            className="ml-auto gap-1 border-transparent text-[10px] font-bold"
            style={{ backgroundColor: `${ssColor}22`, color: ssColor }}
          >
            <Link2 className="h-3 w-3" />
            Superset {ssLabel}
          </Badge>
        )}
      </div>

      {entry.notes?.trim() && (
        <p className="mt-1.5 text-xs italic text-muted-foreground">
          {entry.notes.trim()}
        </p>
      )}

      {totalSets > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs tabular-nums table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[36%]" />
              <col className="w-[22%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Série</th>
                <th className="py-1 pr-2 font-medium">Variante</th>
                <th className="py-1 pr-2 font-medium">Valeur</th>
                <th className="py-1 pr-2 font-medium">kg</th>
                <th className="py-1 font-medium">RPE</th>
              </tr>
            </thead>
            <tbody>
              {entry.sets.map((s) => (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="truncate py-1.5 pr-2 text-muted-foreground">{s.setNumber}</td>
                  <td className="truncate py-1.5 pr-2 font-medium text-foreground">
                    {s.variant ? s.variant.name : "—"}
                  </td>
                  <td className="truncate py-1.5 pr-2 font-medium text-foreground">
                    {s.holdSeconds != null ? (
                      <>{s.holdSeconds} <span className="text-muted-foreground">s</span></>
                    ) : (
                      <>{s.reps ?? "—"} <span className="text-muted-foreground">reps</span></>
                    )}
                  </td>
                  <td className="truncate py-1.5 pr-2 text-muted-foreground">
                    {s.weightKg != null ? `${s.weightKg}` : "—"}
                  </td>
                  <td className="truncate py-1.5 text-muted-foreground">
                    {s.rpe ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
        <span>{totalSets} série{totalSets > 1 ? "s" : ""}</span>
        {totalVol > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{fmtCompact(totalVol)} vol</span>
          </>
        )}
        {best > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>meilleure {best} {unit}</span>
          </>
        )}
      </div>
    </div>
  );
}
