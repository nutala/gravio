"use client";

import * as React from "react";
import { Play, Plus, RotateCcw, FileText, ChevronRight } from "lucide-react";

import { useExercises, useTemplates, useWorkouts } from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import { useDraftStore } from "@/lib/draft-store";
import type { ExerciseWithVariants, WorkoutFull, WorkoutTemplateFull } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Strong-style "start a session" card: one tap to an empty workout, one tap to
 * resume an in-progress one, and a short list of routines to launch directly.
 */
export function QuickStartCard() {
  const { data: templates } = useTemplates();
  const { data: workouts } = useWorkouts();
  const { data: exercises } = useExercises();
  const setView = useAppStore((s) => s.setView);
  const repeatWorkout = useAppStore((s) => s.repeatWorkout);
  const entriesCount = useDraftStore((s) => s.entries.length);
  const resume = entriesCount > 0;

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, ExerciseWithVariants>();
    for (const ex of exercises ?? []) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  function startEmpty() {
    const d = useDraftStore.getState();
    d.resetDraft();
    d.startSession();
    setView("new-workout");
  }

  function startRoutine(tpl: WorkoutTemplateFull) {
    useDraftStore.getState().loadFromTemplate(tpl, exerciseMap);
    setView("new-workout");
  }

  const last: WorkoutFull | undefined = (workouts ?? [])[0];
  const routines = templates ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-stretch gap-2">
          {resume ? (
            <Button onClick={() => setView("new-workout")} className="h-12 flex-1 gap-2 text-base">
              <Play className="h-5 w-5" />
              Reprendre la séance
            </Button>
          ) : (
            <Button onClick={startEmpty} className="h-12 flex-1 gap-2 text-base">
              <Plus className="h-5 w-5" />
              Démarrer une séance
            </Button>
          )}
          {last && (
            <Button
              variant="outline"
              onClick={() => repeatWorkout(last)}
              className="h-12 shrink-0 gap-2"
              title="Refaire la dernière séance"
            >
              <RotateCcw className="h-5 w-5" />
              <span className="hidden sm:inline">Dernière</span>
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mes routines
            </p>
            <button
              type="button"
              onClick={() => setView("templates")}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Gérer
            </button>
          </div>

          {routines.length > 0 ? (
            <div className="space-y-1.5">
              {routines.slice(0, 4).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => startRoutine(tpl)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Play className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{tpl.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tpl.entries.length} exercice{tpl.entries.length > 1 ? "s" : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {routines.length > 4 && (
                <button
                  type="button"
                  onClick={() => setView("templates")}
                  className="w-full py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  +{routines.length - 4} autre{routines.length - 4 > 1 ? "s" : ""} routine
                  {routines.length - 4 > 1 ? "s" : ""} →
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setView("templates")}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border/70 px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <FileText className="h-4 w-4 shrink-0" />
              Crée ta première routine pour démarrer en un tap
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
