"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  PlusCircle,
  Plus,
  Trash2,
  Dumbbell,
  FileText,
  Save,
  Timer,
  Weight,
  Gauge,
  Check,
  Coffee,
  Link2,
  Link2Off,
  RefreshCw,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import {
  type ExerciseWithVariants,
  type ExerciseCategory,
  type ComboStep,
} from "@/lib/types";
import { metricUnit, fmtCompact, supersetLabel, supersetColor, difficultyStars } from "@/lib/calc";
import {
  useExercises,
  useCreateWorkout,
  useUpdateWorkoutEntries,
  useWorkouts,
  useCategoryMeta,
  useTemplates,
  type NewWorkoutPayload,
} from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import {
  useDraftStore,
  nextSupersetGroup,
  usedSupersetGroups,
  type DraftEntry,
  type DraftSet,
} from "@/lib/draft-store";
import { useTimerStore, REST_PRESETS } from "@/lib/timer-store";
import { EmptyState, SectionHeading } from "@/components/app/common";
import { ExercisePickerDialog } from "@/components/app/exercise-picker-dialog";
import { ComboEditor } from "@/components/app/combo-editor";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Play a short pleasant "ding" when a set is validated. */
function playSetSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available — fail silently.
  }
}

/** Adapter so `setMetric` (which expects the Prisma nullable shape) can read a DraftSet. */
function draftMetric(set: DraftSet, defaultMode?: "reps" | "hold"): number {
  const mode = set.mode ?? defaultMode ?? "reps";
  return mode === "reps" ? (set.reps ?? 0) : (set.holdSeconds ?? 0);
}

/** Badge classes for perceived exertion (low → mid → high). */
function exertionBadgeClass(value: number): string {
  if (value <= 3)
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-500";
  if (value <= 6)
    return "border-amber-500/30 bg-amber-500/15 text-amber-500";
  return "border-red-500/30 bg-red-500/15 text-red-500";
}

/** Slider range/thumb color override via descendant selectors. */
function sliderAccentClass(value: number): string {
  if (value <= 3)
    return "[&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500";
  if (value <= 6)
    return "[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500";
  return "[&_[data-slot=slider-range]]:bg-red-500 [&_[data-slot=slider-thumb]]:border-red-500";
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export function NewWorkoutView() {
  // Global draft store — persists across view switches.
  const draft = useDraftStore();
  const exercisesQ = useExercises();
  const exercises = exercisesQ.data ?? [];
  const workoutsQ = useWorkouts();
  const createWorkout = useCreateWorkout();
  const updateWorkoutEntries = useUpdateWorkoutEntries();

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(false);

  const { data: templates } = useTemplates();

  // Resolve exercise objects by id for the draft entries.
  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, ExerciseWithVariants>();
    for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  // ----- Start the session timer automatically on first mount -----
  React.useEffect(() => {
    draft.startSession();
  }, []);

  // ----- Consume "Repeat workout" prefill on mount -----
  const repeatId = useAppStore((s) => s.repeatWorkoutId);
  const consumeRepeat = useAppStore((s) => s.consumeRepeat);
  React.useEffect(() => {
    const id = consumeRepeat();
    if (!id) return;
    const workout = workoutsQ.data?.find((w) => w.id === id);
    if (!workout) {
      toast.info("Données de la séance encore en cours de chargement — réessaie dans un instant.");
      return;
    }
    draft.loadFromWorkout(workout, exerciseMap);
    toast.success(`Séance « ${workout.title || "session"} » chargée — ajuste puis enregistre.`);
  }, [repeatId, workoutsQ.data]);

  // ----- Consume "Edit workout" prefill on mount -----
  const editId = useAppStore((s) => s.editWorkoutId);
  const consumeEdit = useAppStore((s) => s.consumeEdit);
  const [editingWorkoutId, setEditingWorkoutId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const id = consumeEdit();
    if (!id) return;
    const workout = workoutsQ.data?.find((w) => w.id === id);
    if (!workout) {
      toast.info("Données de la séance encore en cours de chargement — réessaie dans un instant.");
      return;
    }
    draft.loadFromWorkout(workout, exerciseMap);
    setEditingWorkoutId(id);
    toast.success(`Séance « ${workout.title || "session"} » chargée pour édition.`);
  }, [editId, workoutsQ.data]);

  const { title, date, exertion, bodyweight, notes, defaultRestSec, entries, sessionStartedAt } = draft;
  const existingGroups = React.useMemo(() => usedSupersetGroups(entries), [entries]);

  function addEntry(exercise: ExerciseWithVariants) {
    draft.addEntry(exercise);
    setPickerOpen(false);

    const entries = useDraftStore.getState().entries;
    const newEntry = entries[entries.length - 1];
    if (!newEntry?.sets[0]) return;

    const firstVariant = exercise.variants
      ?.slice()
      .sort((a, b) => a.difficultyLevel - b.difficultyLevel)[0];
    if (!firstVariant) return;

    fetchLastSet(exercise.id, firstVariant.id).then((last) => {
      draft.updateSet(newEntry.id, newEntry.sets[0].id, {
        variantId: firstVariant.id,
        ...(last ?? {}),
      });
    });
  }

  function handleLoadTemplate(id: string) {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    draft.loadFromTemplate(tpl, exerciseMap);
    setTemplatePickerOpen(false);
    toast.success(`Template « ${tpl.name} » chargé`);
  }

  // ----- derived totals for the sticky bar -----
  const totalSets = entries.reduce((acc, e) => acc + e.sets.length, 0);
  const totalVolume = entries.reduce(
    (acc, e) => {
      const ex = exerciseMap.get(e.exerciseId);
      const defMode = ex?.isStatic ? "hold" : "reps";
      return acc + e.sets.reduce((a, s) => a + draftMetric(s, defMode), 0);
    },
    0,
  );
  const validatedSets = entries.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.validated).length,
    0,
  );

  // ----- save handler -----
  function handleSave() {
    if (entries.length === 0) {
      toast.error("Ajoute au moins un exercice avant d'enregistrer.");
      return;
    }

    for (const entry of entries) {
      const ex = exerciseMap.get(entry.exerciseId);
      if (!ex) {
        toast.error("Un de tes exercices est introuvable. Retire-le puis ré-ajoute-le.");
        return;
      }
      const isCombo = ex.name === "Combos" || entry.comboSteps.length > 0;
      if (isCombo) {
        if (entry.comboSteps.some((st) => !st.done && !st.failed)) {
          toast.error(`« ${ex.name} » — chaque étape doit être validée (✓) ou échouée (✗).`);
          return;
        }
        for (const st of entry.comboSteps) {
          const stepMode = st.mode ?? (st.isStatic ? "hold" : "reps");
          const stepValue = stepMode === "reps" ? st.reps : st.holdSeconds;
          if (stepValue == null || Number.isNaN(stepValue)) {
            toast.error(`« ${ex.name} » — l'étape « ${st.exerciseName} » doit avoir une valeur.`);
            return;
          }
        }
        continue;
      }
      if (entry.sets.length === 0) {
        toast.error(`« ${ex.name} » n'a aucune série. Ajoute-en une ou retire l'entrée.`);
        return;
      }
      for (const set of entry.sets) {
        if (!set.validated) {
          toast.error(`« ${ex.name} » — valide d'abord toutes les séries avant d'enregistrer.`);
          return;
        }
        const rpe = set.rpe;
        if (rpe != null && (rpe < 1 || rpe > 10)) {
          toast.error(`« ${ex.name} » — le RPE doit être entre 1 et 10.`);
          return;
        }
        const mode = set.mode ?? (ex.isStatic ? "hold" : "reps");
        const metric = mode === "reps" ? set.reps : set.holdSeconds;
        if (metric == null || Number.isNaN(metric)) {
          const label = mode === "hold" ? "maintien (s)" : "reps";
          toast.error(
            `Chaque série de « ${ex.name} » doit avoir une valeur de ${label}.`,
          );
          return;
        }
      }
    }

    // Build ISO date at local midnight
    const isoDate = new Date(`${date}T00:00:00`).toISOString();

    const payload: NewWorkoutPayload = {
      date: isoDate,
      title: title.trim() || undefined,
      durationMin: editingWorkoutId
        ? (durationMin || undefined)
        : sessionStartedAt != null
          ? Math.max(1, Math.round((Date.now() - sessionStartedAt) / 60000))
          : undefined,
      perceivedExertion: exertion,
      bodyweightKg: bodyweight === "" ? undefined : bodyweight,
      notes: notes.trim() || undefined,
      entries: entries.map((e) => {
        const ex = exerciseMap.get(e.exerciseId);
        const firstVariant = ex?.variants[0]?.id;
        const isCombo = ex?.name === "Combos" || e.comboSteps.length > 0;
        return {
          exerciseId: e.exerciseId,
          variantId: e.variantId ?? firstVariant ?? null,
          supersetGroup: e.supersetGroup,
          notes: e.notes.trim() || undefined,
          comboSteps: isCombo ? e.comboSteps : undefined,
          weightKg: isCombo ? e.comboWeightKg : undefined,
          rpe: isCombo ? e.comboRpe : undefined,
          comboValidated: isCombo ? e.comboValidated : undefined,
          sets: isCombo ? [] : e.sets.map((s) => {
            const mode = s.mode ?? (
              ex?.isStatic ? "hold" : "reps"
            );
            return {
              variantId: s.variantId ?? firstVariant ?? null,
              reps: mode === "reps" ? s.reps : undefined,
              holdSeconds: mode === "hold" ? s.holdSeconds : undefined,
              weightKg: s.weightKg,
              rpe: s.rpe,
            };
          }),
        };
      }),
    };

    const onSuccess = () => {
      draft.resetDraft();
      setEditingWorkoutId(null);
      useAppStore.getState().setView("history");
    };

    if (editingWorkoutId) {
      updateWorkoutEntries.mutate({ id: editingWorkoutId, body: payload }, { onSuccess });
    } else {
      createWorkout.mutate(payload, { onSuccess });
    }
  }

  function handleCancel() {
    draft.cancelSession();
    setCancelOpen(false);
    useAppStore.getState().setView("dashboard");
  }

  return (
    <div className="space-y-6 pb-28">
      <SectionHeading
        title="Nouvelle séance"
        subtitle="Choisis tes exercices, enregistre tes séries, lance les minuteurs de repos et sauvegarde ta session."
      />

      {/* ----------------------- Header card ----------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Détails de la séance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nw-title">Titre</Label>
              <Input
                id="nw-title"
                placeholder="Focus push & planche"
                value={title}
                onChange={(e) => draft.setMeta("title", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nw-date">Date</Label>
              <Input
                id="nw-date"
                type="date"
                value={date}
                onChange={(e) => draft.setMeta("date", e.target.value)}
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nw-bw">Poids du corps (kg)</Label>
              <Input
                id="nw-bw"
                type="number"
                inputMode="decimal"
                step={0.1}
                placeholder="72"
                value={bodyweight}
                onChange={(e) =>
                  draft.setMeta(
                    "bodyweight",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Repos par défaut</Label>
              <div className="flex flex-wrap gap-1">
                {REST_PRESETS.map((p) => (
                  <Button
                    key={p.sec}
                    type="button"
                    size="sm"
                    variant={p.sec === defaultRestSec ? "default" : "outline"}
                    className="h-8 tabular-nums"
                    onClick={() => draft.setMeta("defaultRestSec", p.sec)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------- Exercise picker trigger ----------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Exercices</h3>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entrée" : "entrées"}
            {validatedSets > 0 && (
              <span className="ml-2 text-emerald-500">
                · {validatedSets}/{totalSets} séries validées
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setTemplatePickerOpen(true)} className="gap-2">
            <FileText className="h-4 w-4" />
            Ajouter un template
          </Button>
          <Button onClick={() => setPickerOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Ajouter un exercice
          </Button>
        </div>
      </div>

      {/* ----------------------- Entries list ----------------------- */}
      {entries.length === 0 ? (
        <EmptyState
          icon={PlusCircle}
          title="Aucun exercice pour le moment"
          description="Ajoute ton premier exercice pour commencer à enregistrer tes séries. Astuce : tu peux regrouper des exercices en supersets et lancer des minuteurs de repos entre les séries."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <PlusCircle className="h-4 w-4" />
              Ajouter un exercice
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry, idx) => {
            const exercise = exerciseMap.get(entry.exerciseId);
            if (!exercise) return null;
            const prevEntry = idx > 0 ? entries[idx - 1] : null;
            const sameSupersetAsPrev =
              entry.supersetGroup != null &&
              prevEntry?.supersetGroup === entry.supersetGroup;
            return (
              <EntryCard
                key={entry.id}
                entry={entry}
                exercise={exercise}
                defaultRestSec={defaultRestSec}
                supersetCount={entries.filter(
                  (e) => e.supersetGroup === entry.supersetGroup,
                ).length}
                isFirstOfSuperset={
                  entry.supersetGroup != null &&
                  !sameSupersetAsPrev
                }
                canJoinPrevSuperset={prevEntry?.supersetGroup != null}
                onChange={(patch) => draft.updateEntry(entry.id, patch)}
                onRemove={() => draft.removeEntry(entry.id)}
                onAddSet={(defaults) => draft.addSet(entry.id, defaults)}
                onUpdateSet={(setId, patch) =>
                  draft.updateSet(entry.id, setId, patch)
                }
                onRemoveSet={(setId) => draft.removeSet(entry.id, setId)}
                onValidateSet={(setId, v) =>
                  draft.validateSet(entry.id, setId, v)
                }
                allGroups={existingGroups}
                nextGroup={nextSupersetGroup(entries)}
                onSelectSuperset={(group) =>
                  draft.setSuperset(entry.id, group)
                }
                onAddComboStep={(step) => draft.addComboStep(entry.id, step)}
                onRemoveComboStep={(stepId) => draft.removeComboStep(entry.id, stepId)}
                onUpdateComboStep={(stepId, patch) => draft.updateComboStep(entry.id, stepId, patch)}
                onReorderComboStep={(stepId, dir) => draft.reorderComboStep(entry.id, stepId, dir)}
                onToggleComboValidated={() => {
                  const validating = !entry.comboValidated;
                  entry.comboSteps.forEach((step) => {
                    draft.updateComboStep(entry.id, step.id, { done: validating, failed: false });
                  });
                  draft.toggleComboValidated(entry.id);
                }}
                onComboWeightKgChange={(v) => draft.updateEntry(entry.id, { comboWeightKg: v })}
                onComboRpeChange={(v) => draft.updateEntry(entry.id, { comboRpe: v })}
              />
            );
          })}
          {/* Bottom "add exercise" button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Ajouter un exercice
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------- RPE + Notes (before save) ----------------------- */}
      <div className="mx-auto max-w-7xl space-y-3 px-4 sm:px-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Effort perçu</Label>
            <Badge
              variant="outline"
              className={cn("tabular-nums", exertionBadgeClass(exertion))}
            >
              {exertion}/10
            </Badge>
          </div>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[exertion]}
            onValueChange={(v) => draft.setMeta("exertion", v[0] ?? 5)}
            className={cn("mt-2", sliderAccentClass(exertion))}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>1 Facile</span>
            <span>5 Modéré</span>
            <span>10 Max</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nw-notes">Notes</Label>
          <Textarea
            id="nw-notes"
            placeholder="Comment s'est passée la séance ?"
            value={notes}
            onChange={(e) => draft.setMeta("notes", e.target.value)}
          />
        </div>
      </div>

      {/* ----------------------- Sticky save bar ----------------------- */}
      <div className="sticky bottom-4 z-30">
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            {sessionStartedAt != null && (
              <SessionTimer startedAt={sessionStartedAt} />
            )}
            <div className="flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium tabular-nums">{entries.length}</span>
              <span className="text-muted-foreground">entrées</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium tabular-nums">{totalSets}</span>
              <span className="text-muted-foreground">séries</span>
            </div>
            {validatedSets > 0 && (
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="font-medium tabular-nums text-emerald-500">
                  {validatedSets}
                </span>
                <span className="text-muted-foreground">validées</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium tabular-nums">
                {fmtCompact(totalVolume)}
              </span>
              <span className="text-muted-foreground">volume total</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={createWorkout.isPending || updateWorkoutEntries.isPending}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={createWorkout.isPending || updateWorkoutEntries.isPending}
              className="sm:min-w-44"
            >
              {createWorkout.isPending || updateWorkoutEntries.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingWorkoutId ? "Mettre à jour la séance" : "Enregistrer la séance"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------- Cancel confirmation ----------------------- */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les séries en cours seront perdues. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer la séance</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Annuler la séance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ----------------------- Exercise picker dialog ----------------------- */}
      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={addEntry}
      />

      {/* ----------------------- Template picker dialog ----------------------- */}
      {templatePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTemplatePickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">Charger un template</h3>
            {!templates || templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun template disponible. Crée-en un depuis la page Exercices.
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleLoadTemplate(tpl.id)}
                    className="w-full rounded-md border border-border/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <div className="font-medium">{tpl.name}</div>
                    {tpl.notes && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {tpl.notes}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tpl.entries.slice(0, 5).map((e) => (
                        <span
                          key={e.id}
                          className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {e.exercise.name}
                        </span>
                      ))}
                      {tpl.entries.length > 5 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{tpl.entries.length - 5}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplatePickerOpen(false)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionTimer — live stopwatch from sessionStartedAt
// ---------------------------------------------------------------------------
function SessionTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const display = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5 text-primary">
      <Clock className="h-4 w-4" />
      <span className="font-bold tabular-nums">{display}</span>
      <span className="text-muted-foreground">séance</span>
    </div>
  );
}

/** Fetch the last performed set values for a given exercise+variant. */
async function fetchLastSet(
  exerciseId: string,
  variantId: string,
): Promise<Partial<DraftSet> | null> {
  try {
    const params = new URLSearchParams({ exerciseId, variantId });
    const data = await api.get<{
      reps: number | null;
      holdSeconds: number | null;
      weightKg: number | null;
      rpe: number | null;
    } | null>(`/api/sets/last?${params}`);
    if (!data) return null;
    return {
      reps: data.reps ?? undefined,
      holdSeconds: data.holdSeconds ?? undefined,
      weightKg: data.weightKg ?? undefined,
      rpe: data.rpe ?? undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// EntryCard — one exercise with its sets
// ---------------------------------------------------------------------------
function EntryCard({
  entry,
  exercise,
  defaultRestSec,
  supersetCount,
  isFirstOfSuperset,
  canJoinPrevSuperset,
  allGroups,
  nextGroup,
  onChange,
  onRemove,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onValidateSet,
  onSelectSuperset,
  onAddComboStep,
  onRemoveComboStep,
  onUpdateComboStep,
  onReorderComboStep,
  onToggleComboValidated,
  onComboWeightKgChange,
  onComboRpeChange,
}: {
  entry: DraftEntry;
  exercise: ExerciseWithVariants;
  defaultRestSec: number;
  supersetCount: number;
  isFirstOfSuperset: boolean;
  canJoinPrevSuperset: boolean;
  allGroups: number[];
  nextGroup: number;
  onChange: (patch: Partial<DraftEntry>) => void;
  onRemove: () => void;
  onAddSet: (defaults?: Partial<DraftSet>) => void;
  onUpdateSet: (setId: string, patch: Partial<DraftSet>) => void;
  onRemoveSet: (setId: string) => void;
  onValidateSet: (setId: string, validated: boolean) => void;
  onSelectSuperset: (group: number | null) => void;
  onAddComboStep?: (step: ComboStep) => void;
  onRemoveComboStep?: (stepId: string) => void;
  onUpdateComboStep?: (stepId: string, patch: Partial<ComboStep>) => void;
  onReorderComboStep?: (stepId: string, direction: "up" | "down") => void;
  onToggleComboValidated?: () => void;
  onComboWeightKgChange?: (value: number | undefined) => void;
  onComboRpeChange?: (value: number | undefined) => void;
}) {
  const { variantId, notes, sets, supersetGroup, comboSteps, comboWeightKg, comboRpe, comboValidated } = entry;
  const isCombo = exercise.name === "Combos" || comboSteps.length > 0;
  const getCatMeta = useCategoryMeta();
  const cat = exercise.category as ExerciseCategory;
  const meta = getCatMeta(cat);
  const isStatic = exercise.isStatic;
  const metricLabel = isStatic ? "Maintien (s)" : "Reps";

  const totalSetsCount = sets.length;
  const validatedCount = sets.filter((s) => s.validated).length;
  const repsVolume = sets.reduce((a, s) => {
    const m = s.mode ?? (isStatic ? "hold" : "reps");
    return a + (m === "reps" ? (s.reps ?? 0) : 0);
  }, 0);
  const holdVolume = sets.reduce((a, s) => {
    const m = s.mode ?? (isStatic ? "hold" : "reps");
    return a + (m === "hold" ? (s.holdSeconds ?? 0) : 0);
  }, 0);
  const bestReps = sets.reduce((m, s) => {
    const mode = s.mode ?? (isStatic ? "hold" : "reps");
    return mode === "reps" ? Math.max(m, s.reps ?? 0) : m;
  }, 0);
  const bestHold = sets.reduce((m, s) => {
    const mode = s.mode ?? (isStatic ? "hold" : "reps");
    return mode === "hold" ? Math.max(m, s.holdSeconds ?? 0) : m;
  }, 0);
  const hasReps = repsVolume > 0;
  const hasHold = holdVolume > 0;

  const sortedVariants = exercise.variants
    ? exercise.variants.slice().sort((a, b) => a.difficultyLevel - b.difficultyLevel)
    : [];

  const ssColor = supersetColor(supersetGroup);
  const ssLabel = supersetLabel(supersetGroup);
  const inSuperset = supersetGroup != null;

  async function handleAddSet() {
    // Read latest entry from store (not closure) to avoid race conditions
    // when handleVariantChange (async) hasn't resolved yet.
    const latest = useDraftStore.getState().entries.find((e) => e.id === entry.id);
    const latestSets = latest?.sets ?? sets;
    const lastSet = latestSets[latestSets.length - 1];
    const defaults: Partial<DraftSet> = {};
    const variantId = lastSet?.variantId ?? (sortedVariants.length > 0 ? sortedVariants[0].id : undefined);
    if (variantId) defaults.variantId = variantId;
    if (lastSet?.mode) defaults.mode = lastSet.mode;
    const last = variantId ? await fetchLastSet(exercise.id, variantId) : null;
    if (last) {
      defaults.reps = last.reps;
      defaults.holdSeconds = last.holdSeconds;
      defaults.weightKg = last.weightKg;
      defaults.rpe = last.rpe;
    }
    onAddSet(defaults);
  }

  async function handleVariantChange(setId: string, newVariantId: string) {
    const last = await fetchLastSet(exercise.id, newVariantId);
    onUpdateSet(setId, { variantId: newVariantId, ...last });
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        inSuperset && "shadow-sm",
      )}
      style={
        inSuperset && ssColor
          ? { borderLeftColor: ssColor, borderLeftWidth: 4 }
          : undefined
      }
    >
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {meta.emoji}
            </span>
            <CardTitle className="truncate text-base">
              {exercise.name}
            </CardTitle>
            <Badge
              variant="outline"
              className="border-transparent"
              style={{
                backgroundColor: `${meta.color}22`,
                color: meta.color,
              }}
            >
              {meta.label}
            </Badge>
            {(exercise as unknown as { tags: string[] }).tags?.map((tag) => {
              const tagMeta = getCatMeta(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className="gap-1 text-[9px] font-medium leading-tight"
                  style={{
                    borderColor: `${tagMeta.color}44`,
                    color: tagMeta.color,
                  }}
                >
                  {tagMeta.emoji} {tagMeta.label}
                </Badge>
              );
            })}
            {isStatic && (
              <Badge variant="secondary" className="text-[10px]">
                Maintien (s)
              </Badge>
            )}
            {inSuperset && ssColor && ssLabel && (
              <Badge
                variant="outline"
                className="gap-1 border-transparent text-[10px] font-bold"
                style={{ backgroundColor: `${ssColor}22`, color: ssColor }}
                title={`Superset ${ssLabel} · ${supersetCount} exercice${supersetCount > 1 ? "s" : ""}`}
              >
                <Link2 className="h-3 w-3" />
                Superset {ssLabel}
              </Badge>
            )}
          </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8",
                    inSuperset
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary",
                  )}
                  aria-label="Options de superset"
                >
                  {inSuperset ? (
                    <Link2Off className="h-4 w-4" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {inSuperset && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onSelectSuperset(null)}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Link2Off className="h-4 w-4" />
                      Retirer du superset{" "}
                      {supersetLabel(supersetGroup)}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {allGroups
                  .filter((g) => g !== supersetGroup)
                  .map((g) => (
                    <DropdownMenuItem
                      key={g}
                      onClick={() => onSelectSuperset(g)}
                      className="gap-2"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: supersetColor(g) }}
                      />
                      Superset {supersetLabel(g)}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem
                  onClick={() => onSelectSuperset(nextGroup)}
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Nouveau superset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="ghost"
              onClick={onRemove}
              aria-label={`Retirer ${exercise.name}`}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
        </div>

        {/* Superset hint when first of a group */}
        {isFirstOfSuperset && supersetCount > 1 && ssColor && (
          <p
            className="text-xs font-medium"
            style={{ color: ssColor }}
          >
            ↳ Superset {ssLabel} : enchaîne les {supersetCount - 1} exercice{supersetCount - 1 > 1 ? "s" : ""} suivant{supersetCount - 1 > 1 ? "s" : ""} sans repos.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          placeholder="Indices d'exécution..."
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="h-8"
          aria-label={`Notes pour ${exercise.name}`}
        />

        {isCombo ? (
          <ComboEditor
            steps={comboSteps}
            weightKg={comboWeightKg}
            rpe={comboRpe}
            validated={comboValidated}
            onAddStep={onAddComboStep!}
            onRemoveStep={onRemoveComboStep!}
            onUpdateStep={onUpdateComboStep!}
            onReorderStep={onReorderComboStep!}
            onToggleValidated={onToggleComboValidated}
            onWeightKgChange={onComboWeightKgChange}
            onRpeChange={onComboRpeChange}
          />
        ) : (
          <>
            {/* Desktop: inline table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="w-10 pb-2 text-left font-medium">Série</th>
                    <th className="pb-2 text-left font-medium">Valeur</th>
                    {sortedVariants.length > 0 && (
                      <th className="w-20 pb-2 text-left font-medium">Var.</th>
                    )}
                    <th className="pb-2 text-left font-medium">Poids (kg)</th>
                    <th className="pb-2 text-left font-medium">RPE</th>
                    <th className="w-20 pb-2 text-center font-medium">Fait</th>
                    <th className="w-24 pb-2 text-right font-medium">Repos</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set, idx) => (
                    <SetRowDesktop
                      key={set.id}
                      set={set}
                      idx={idx}
                      isStatic={isStatic}
                      metricLabel={metricLabel}
                      defaultRestSec={defaultRestSec}
                      variants={sortedVariants}
                      onUpdate={(patch) => onUpdateSet(set.id, patch)}
                      onRemove={() => onRemoveSet(set.id)}
                      onValidate={(v) => onValidateSet(set.id, v)}
                      onVariantChange={(vid) => handleVariantChange(set.id, vid)}
                    />
                  ))}
                  {sets.length === 0 && (
                    <tr>
                      <td
                        colSpan={sortedVariants.length > 0 ? 8 : 7}
                        className="py-3 text-center text-xs text-muted-foreground"
                      >
                        Aucune série pour le moment — ajoute-en une ci-dessous.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards */}
            <div className="space-y-2 sm:hidden">
              {sets.map((set, idx) => (
                <SetRowMobile
                  key={set.id}
                  set={set}
                  idx={idx}
                  isStatic={isStatic}
                  metricLabel={metricLabel}
                  defaultRestSec={defaultRestSec}
                  variants={sortedVariants}
                  onUpdate={(patch) => onUpdateSet(set.id, patch)}
                  onRemove={() => onRemoveSet(set.id)}
                  onValidate={(v) => onValidateSet(set.id, v)}
                  onVariantChange={(vid) => handleVariantChange(set.id, vid)}
                />
              ))}
              {sets.length === 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Aucune série pour le moment — ajoute-en une ci-dessous.
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={handleAddSet}>
              <Plus className="h-4 w-4" />
              Ajouter une série
            </Button>

            <Separator />

            {/* Per-entry summary */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {totalSetsCount}
                </span>{" "}
                séries
              </span>
              {(hasReps || hasHold) && (
                <span>
                  Volume{" "}
                  {hasReps && (
                    <>
                      <span className="font-medium text-foreground tabular-nums">
                        {fmtCompact(repsVolume)}
                      </span>{" "}
                      reps
                    </>
                  )}
                  {hasReps && hasHold && <span className="mx-0.5">·</span>}
                  {hasHold && (
                    <>
                      <span className="font-medium text-foreground tabular-nums">
                        {fmtCompact(holdVolume)}
                      </span>{" "}
                      s
                    </>
                  )}
                </span>
              )}
              {(bestReps > 0 || bestHold > 0) && (
                <span>
                  Meilleure{" "}
                  {bestReps > 0 && (
                    <>
                      <span className="font-medium text-foreground tabular-nums">
                        {fmtCompact(bestReps)}
                      </span>{" "}
                      reps
                    </>
                  )}
                  {bestReps > 0 && bestHold > 0 && <span className="mx-0.5">·</span>}
                  {bestHold > 0 && (
                    <>
                      <span className="font-medium text-foreground tabular-nums">
                        {fmtCompact(bestHold)}
                      </span>{" "}
                      s
                    </>
                  )}
                </span>
              )}
              {validatedCount > 0 && (
                <span className="text-emerald-500">
                  <span className="font-medium tabular-nums">{validatedCount}</span> validée{validatedCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Set rows
// ---------------------------------------------------------------------------

function ValidateButton({
  validated,
  onClick,
  label,
}: {
  validated: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!validated) playSetSound();
        onClick();
      }}
      aria-label={label}
      aria-pressed={validated}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all",
        validated
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
          : "border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-500",
      )}
    >
      <Check className={cn("h-4 w-4", validated && "scale-110")} />
    </button>
  );
}

function RestButton({
  defaultRestSec,
  validated,
}: {
  defaultRestSec: number;
  validated: boolean;
}) {
  const start = useTimerStore((s) => s.start);
  const [open, setOpen] = React.useState(false);

  // When the popover is open we show preset buttons; otherwise the main
  // button starts the default rest timer directly.
  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant={validated ? "secondary" : "outline"}
        className={cn(
          "h-8 gap-1.5",
          validated && "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400",
        )}
        onClick={() => start(defaultRestSec)}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        title="Clic pour lancer le repos · Clic droit pour les préréglages"
      >
        <Coffee className="h-3.5 w-3.5" />
        <span className="tabular-nums">{defaultRestSec}s</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {REST_PRESETS.map((p) => (
        <Button
          key={p.sec}
          type="button"
          size="sm"
          variant={p.sec === defaultRestSec ? "default" : "ghost"}
          className="h-7 tabular-nums"
          onClick={() => {
            start(p.sec);
            setOpen(false);
          }}
        >
          {p.label}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => setOpen(false)}
      >
        ✕
      </Button>
    </div>
  );
}

function SetRowDesktop({
  set,
  idx,
  isStatic,
  metricLabel,
  defaultRestSec,
  variants,
  onUpdate,
  onRemove,
  onValidate,
  onVariantChange,
}: {
  set: DraftSet;
  idx: number;
  isStatic: boolean;
  metricLabel: string;
  defaultRestSec: number;
  variants: { id: string; name: string; difficultyLevel: number }[];
  onUpdate: (patch: Partial<DraftSet>) => void;
  onRemove: () => void;
  onValidate: (validated: boolean) => void;
  onVariantChange: (variantId: string) => void;
}) {
  const validated = set.validated;
  const mode = set.mode ?? (isStatic ? "hold" : "reps");
  const otherMode = mode === "reps" ? "hold" : "reps";
  return (
    <tr
      className={cn(
        "border-t border-border/50 transition-colors",
        validated && "bg-emerald-500/8",
      )}
    >
      <td className="py-2 text-muted-foreground tabular-nums">{idx + 1}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <NumberInput
            value={mode === "reps" ? set.reps : set.holdSeconds}
            placeholder={mode === "hold" ? "30" : "8"}
            aria-label={`${mode === "hold" ? "Maintien" : "Reps"} pour la série ${idx + 1}`}
            onChange={(n) =>
              onUpdate(mode === "reps" ? { reps: n } : { holdSeconds: n })
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            onClick={() => onUpdate({ mode: otherMode })}
            aria-label={`Passer en ${otherMode === "reps" ? "répétitions" : "maintien (s)"}`}
          >
            {mode === "reps" ? "Reps" : "Maintien (s)"}
          </Button>
        </div>
      </td>
      {variants.length > 0 && (
        <td className="py-2 pr-2">
          <select
            value={set.variantId ?? variants[0]?.id}
            onChange={(e) => onVariantChange(e.target.value)}
            className="h-9 w-44 rounded-md border border-border/60 bg-background px-1.5 text-xs tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label={`Variante pour la série ${idx + 1}`}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {difficultyStars(v.difficultyLevel)}
              </option>
            ))}
          </select>
        </td>
      )}
      <td className="py-2 pr-2">
        <div className="flex items-center gap-0.5">
          <NumberInput
            value={set.weightKg}
            placeholder="0"
            step={0.5}
            aria-label={`Poids pour la série ${idx + 1}`}
            onChange={(n) => onUpdate({ weightKg: n })}
          />
          <button
            type="button"
            onClick={() => onUpdate({ weightKg: -(set.weightKg ?? 0) })}
            className="flex h-9 w-5 items-center justify-center rounded-md border border-border/60 text-[10px] tabular-nums text-muted-foreground hover:bg-muted"
            aria-label="Inverser le signe du poids"
          >
            ±
          </button>
        </div>
      </td>
      <td className="py-2 pr-2">
        <NumberInput
          value={set.rpe}
          placeholder="7"
          min={1}
          max={10}
          aria-label={`RPE pour la série ${idx + 1}`}
          onChange={(n) => onUpdate({ rpe: n })}
        />
      </td>
      <td className="py-2 text-center">
        <ValidateButton
          validated={validated}
          onClick={() => onValidate(!validated)}
          label={`Marquer la série ${idx + 1} comme ${validated ? "non faite" : "faite"}`}
        />
      </td>
      <td className="py-2 text-right">
        <RestButton defaultRestSec={defaultRestSec} validated={validated} />
      </td>
      <td className="py-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Supprimer la série ${idx + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function SetRowMobile({
  set,
  idx,
  isStatic,
  metricLabel,
  defaultRestSec,
  variants,
  onUpdate,
  onRemove,
  onValidate,
  onVariantChange,
}: {
  set: DraftSet;
  idx: number;
  isStatic: boolean;
  metricLabel: string;
  defaultRestSec: number;
  variants: { id: string; name: string; difficultyLevel: number }[];
  onUpdate: (patch: Partial<DraftSet>) => void;
  onRemove: () => void;
  onValidate: (validated: boolean) => void;
  onVariantChange: (variantId: string) => void;
}) {
  const validated = set.validated;
  const mode = set.mode ?? (isStatic ? "hold" : "reps");
  const otherMode = mode === "reps" ? "hold" : "reps";
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-muted/20 p-3 transition-colors",
        validated
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-border/60",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
          Série {idx + 1}
        </span>
        <div className="flex items-center gap-1">
          <ValidateButton
            validated={validated}
            onClick={() => onValidate(!validated)}
            label={`Marquer la série ${idx + 1} comme ${validated ? "non faite" : "faite"}`}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Supprimer la série ${idx + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onUpdate({ mode: otherMode })}
              className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              aria-label={`Passer en ${otherMode === "reps" ? "répétitions" : "maintien (s)"}`}
            >
              {mode === "reps" ? "Reps" : "Maintien (s)"}
            </button>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={mode === "hold" ? "30" : "8"}
            value={mode === "reps" ? (set.reps ?? "") : (set.holdSeconds ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate(
                mode === "reps"
                  ? { reps: v === "" ? undefined : Number(v) || undefined }
                  : { holdSeconds: v === "" ? undefined : Number(v) || undefined },
              );
            }}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Poids (kg)
          </span>
          <div className="flex items-center gap-0.5">
            <Input
              type="number"
              inputMode="decimal"
              step={0.5}
              placeholder="0"
              value={set.weightKg ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onUpdate({
                  weightKg: v === "" ? undefined : Number(v) || undefined,
                });
              }}
              className="h-9 tabular-nums"
            />
            <button
              type="button"
              onClick={() => onUpdate({ weightKg: -(set.weightKg ?? 0) })}
              className="flex h-9 w-5 shrink-0 items-center justify-center rounded-md border border-border/60 text-[10px] tabular-nums text-muted-foreground hover:bg-muted"
              aria-label="Inverser le signe du poids"
            >
              ±
            </button>
          </div>
        </div>
        <LabeledNumber
          label="RPE"
          value={set.rpe}
          placeholder="7"
          min={1}
          max={10}
          onChange={(n) => onUpdate({ rpe: n })}
        />
      </div>
      {variants.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Variante
          </span>
          <select
            value={set.variantId ?? variants[0]?.id}
            onChange={(e) => onVariantChange(e.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-1.5 text-xs tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {difficultyStars(v.difficultyLevel)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <RestButton defaultRestSec={defaultRestSec} validated={validated} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small numeric input primitives
// ---------------------------------------------------------------------------
function NumberInput({
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  "aria-label": ariaLabel,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  "aria-label"?: string;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") {
          onChange(undefined);
          return;
        }
        const n = Number(v);
        if (Number.isNaN(n)) {
          onChange(undefined);
          return;
        }
        onChange(n);
      }}
      className="h-9 w-16 tabular-nums"
      aria-label={ariaLabel}
    />
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(undefined);
            return;
          }
          const n = Number(v);
          if (Number.isNaN(n)) {
            onChange(undefined);
            return;
          }
          onChange(n);
        }}
        className="h-9 tabular-nums"
      />
    </div>
  );
}
