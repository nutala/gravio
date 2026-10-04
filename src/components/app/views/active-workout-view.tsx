"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  PlusCircle,
  Plus,
  Trash2,
  Timer,
  Check,
  Link2,
  Link2Off,
  Clock,
  X,
  MoreHorizontal,
  Settings2,
  Gauge,
  FileText,
  Save,
  Trophy,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api, QueuedOfflineError } from "@/lib/api-client";
import { type ExerciseWithVariants, type ExerciseCategory, type ComboStep } from "@/lib/types";
import { fmtCompact, supersetLabel, supersetColor, difficultyStars, fmtDate } from "@/lib/calc";
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
import { EmptyState } from "@/components/app/common";
import { ExercisePickerDialog } from "@/components/app/exercise-picker-dialog";
import { ComboEditor } from "@/components/app/combo-editor";
import { playChime } from "@/lib/sound";
import { WorkoutSummaryModal, type WorkoutSummary } from "@/components/app/WorkoutSummaryModal";
import { useWorkoutShortcuts } from "@/hooks/use-workout-shortcuts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

function draftMetric(set: DraftSet, defaultMode?: "reps" | "hold"): number {
  const modeMode = set.mode ?? defaultMode ?? "reps";
  return modeMode === "reps" ? (set.reps ?? 0) : (set.holdSeconds ?? 0);
}

function exertionBadgeClass(value: number): string {
  if (value <= 3) return "border-emerald-500/30 bg-emerald-500/15 text-emerald-500";
  if (value <= 6) return "border-amber-500/30 bg-amber-500/15 text-amber-500";
  return "border-red-500/30 bg-red-500/15 text-red-500";
}

function sliderAccentClass(value: number): string {
  if (value <= 3) return "[&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500";
  if (value <= 6) return "[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500";
  return "[&_[data-slot=slider-range]]:bg-red-500 [&_[data-slot=slider-thumb]]:border-red-500";
}

type HistorySet = {
  reps: number | null;
  holdSeconds: number | null;
  weightKg: number | null;
  rpe: number | null;
};

async function fetchLastSession(exerciseId: string, variantId?: string): Promise<HistorySet[]> {
  try {
    const params = new URLSearchParams({ exerciseId });
    if (variantId) params.set("variantId", variantId);
    const data = await api.get<{ sets: HistorySet[] }>(`/api/sets/last-session?${params}`);
    return data?.sets ?? [];
  } catch {
    return [];
  }
}

/** Compact label for a previous-session set, e.g. "+10×14" / "12" / "30s". */
function previousLabel(s: HistorySet | undefined, mode: "reps" | "hold"): string | null {
  if (!s) return null;
  const value = mode === "reps" ? s.reps : s.holdSeconds;
  if (value == null) return null;
  const w = s.weightKg;
  const load = w != null && w !== 0 ? `${w > 0 ? "+" : ""}${w}×` : "";
  const unit = mode === "hold" ? "s" : "";
  return `${load}${value}${unit}`;
}

function computePRs(
  saved: import("@/lib/types").WorkoutFull,
  allWorkouts: import("@/lib/types").WorkoutFull[],
  exMap: Map<string, ExerciseWithVariants>,
): WorkoutSummary["prs"] {
  const prs: WorkoutSummary["prs"] = [];
  const previous = allWorkouts.filter((w) => w.id !== saved.id);
  for (const entry of saved.entries) {
    const ex = exMap.get(entry.exerciseId);
    if (!ex) continue;
    const bestByKey = new Map<string, { val: number; mode: "reps" | "hold"; vName: string | null }>();
    for (const s of entry.sets) {
      const mode: "reps" | "hold" = s.reps != null ? "reps" : "hold";
      const val = s.reps ?? s.holdSeconds ?? 0;
      if (val === 0) continue;
      const key = `${entry.exerciseId}::${s.variantId ?? ""}`;
      const existing = bestByKey.get(key);
      if (!existing || val > existing.val) {
        const vName = s.variantId ? ex.variants.find((v) => v.id === s.variantId)?.name ?? null : null;
        bestByKey.set(key, { val, mode, vName });
      }
    }
    for (const [key, cur] of bestByKey) {
      const [, variantId] = key.split("::");
      let bestPrev = 0;
      for (const w of previous) {
        for (const e of w.entries) {
          if (e.exerciseId !== entry.exerciseId) continue;
          for (const s of e.sets) {
            if ((s.variantId ?? "") !== variantId) continue;
            const val = s.reps ?? s.holdSeconds ?? 0;
            if (val > bestPrev) bestPrev = val;
          }
        }
      }
      if (cur.val > bestPrev) {
        prs.push({
          exerciseName: ex.name,
          variantName: cur.vName,
          value: `${cur.val}`,
          unit: cur.mode === "reps" ? "reps" : "s",
        });
      }
    }
  }
  return prs;
}

function sessionClock(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main view — Strong-style active workout
// ---------------------------------------------------------------------------
export function ActiveWorkoutView() {
  const draft = useDraftStore();
  const exercisesQ = useExercises();
  const exercises = exercisesQ.data ?? [];
  const workoutsQ = useWorkouts();
  const createWorkout = useCreateWorkout();
  const updateWorkoutEntries = useUpdateWorkoutEntries();
  const { data: templates } = useTemplates();

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [summaryData, setSummaryData] = React.useState<WorkoutSummary | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = React.useState<string | null>(null);

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, ExerciseWithVariants>();
    for (const ex of exercises) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  React.useEffect(() => {
    draft.startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repeat / edit prefill
  const repeatId = useAppStore((s) => s.repeatWorkoutId);
  const consumeRepeat = useAppStore((s) => s.consumeRepeat);
  React.useEffect(() => {
    if (!workoutsQ.data) return;
    const id = consumeRepeat();
    if (!id) return;
    const workout = workoutsQ.data.find((w) => w.id === id);
    if (!workout) return;
    draft.loadFromWorkout(workout, exerciseMap, false);
    draft.setMeta("date", format(new Date(), "yyyy-MM-dd"));
    draft.resetAllValidations();
    draft.startSession();
    toast.success(`Séance « ${workout.title || "session"} » chargée.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatId, workoutsQ.data]);

  const editId = useAppStore((s) => s.editWorkoutId);
  const consumeEdit = useAppStore((s) => s.consumeEdit);
  React.useEffect(() => {
    if (!workoutsQ.data) return;
    const id = consumeEdit();
    if (!id) return;
    const workout = workoutsQ.data.find((w) => w.id === id);
    if (!workout) return;
    draft.loadFromWorkout(workout, exerciseMap, true);
    setEditingWorkoutId(id);
    toast.success(`Séance « ${workout.title || "session"} » chargée pour édition.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, workoutsQ.data]);

  const { title, date, exertion, bodyweight, notes, defaultRestSec, entries, sessionStartedAt, durationMin } = draft;
  const existingGroups = React.useMemo(() => usedSupersetGroups(entries), [entries]);

  const firstUnvalidatedEntryIndex = React.useMemo(
    () => entries.findIndex((e) => e.sets.some((s) => !s.validated)),
    [entries],
  );
  const firstUnvalidatedSetIndex = React.useMemo(() => {
    if (firstUnvalidatedEntryIndex === -1) return -1;
    return entries[firstUnvalidatedEntryIndex].sets.findIndex((s) => !s.validated);
  }, [entries, firstUnvalidatedEntryIndex]);

  const scrollToFirstUnvalidated = useAppStore((s) => s.scrollToFirstUnvalidated);
  const resetScrollToFirstUnvalidated = useAppStore((s) => s.resetScrollToFirstUnvalidated);
  React.useEffect(() => {
    if (!scrollToFirstUnvalidated) return;
    const entryIdx = entries.findIndex((e) => e.sets.some((s) => !s.validated));
    if (entryIdx === -1) { resetScrollToFirstUnvalidated(); return; }
    const entryId = entries[entryIdx].id;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-entry-id="${entryId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      resetScrollToFirstUnvalidated();
    });
  }, [scrollToFirstUnvalidated, entries, resetScrollToFirstUnvalidated]);

  const { showCheatsheet, setShowCheatsheet } = useWorkoutShortcuts({
    onValidateCurrentSet: () => {
      if (firstUnvalidatedEntryIndex === -1 || firstUnvalidatedSetIndex === -1) return;
      const entry = entries[firstUnvalidatedEntryIndex];
      const set = entry.sets[firstUnvalidatedSetIndex];
      draft.validateSet(entry.id, set.id, true);
    },
    onAddSet: () => {
      if (entries.length === 0) return;
      draft.addSet(entries[entries.length - 1].id);
    },
    onStartRest: () => useTimerStore.getState().start(defaultRestSec),
  });

  function handleCloseSummary() {
    setSummaryOpen(false);
    setSummaryData(null);
    draft.resetDraft();
    setEditingWorkoutId(null);
    useAppStore.getState().setView("history");
  }

  function handleViewProgressFromSummary() {
    setSummaryOpen(false);
    setSummaryData(null);
    draft.resetDraft();
    setEditingWorkoutId(null);
    useAppStore.getState().setView("stats");
  }

  function addEntry(exercise: ExerciseWithVariants) {
    draft.addEntry(exercise);
    setPickerOpen(false);
    const next = useDraftStore.getState().entries;
    const newEntry = next[next.length - 1];
    if (!newEntry?.sets[0]) return;
    const firstVariant = exercise.variants?.slice().sort((a, b) => a.difficultyLevel - b.difficultyLevel)[0];
    if (!firstVariant) return;
    draft.updateSet(newEntry.id, newEntry.sets[0].id, { variantId: firstVariant.id });
  }

  function handleLoadTemplate(id: string) {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    draft.loadFromTemplate(tpl, exerciseMap);
    setTemplatePickerOpen(false);
    toast.success(`Template « ${tpl.name} » chargé`);
  }

  const totalSets = entries.reduce((a, e) => a + e.sets.length, 0);
  const validatedSets = entries.reduce((a, e) => a + e.sets.filter((s) => s.validated).length, 0);
  const totalVolume = entries.reduce((acc, e) => {
    const ex = exerciseMap.get(e.exerciseId);
    const defMode = ex?.isStatic ? "hold" : "reps";
    return acc + e.sets.reduce((a, s) => a + draftMetric(s, defMode), 0);
  }, 0);

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
        continue;
      }
      if (entry.sets.length === 0) {
        toast.error(`« ${ex.name} » n'a aucune série. Ajoute-en une ou retire l'entrée.`);
        return;
      }
      // Strong-style: sets left unvalidated are simply not recorded; only the
      // sets the athlete actually completed are saved.
      const done = entry.sets.filter((s) => s.validated);
      if (done.length === 0) {
        toast.error(`« ${ex.name} » — valide au moins une série (✓) avant d'enregistrer.`);
        return;
      }
      for (const set of done) {
        const mode = set.mode ?? (ex.isStatic ? "hold" : "reps");
        const metric = mode === "reps" ? set.reps : set.holdSeconds;
        if (metric == null || Number.isNaN(metric)) {
          toast.error(`« ${ex.name} » — renseigne la valeur (${mode === "hold" ? "maintien" : "reps"}).`);
          return;
        }
      }
    }

    const isoDate = new Date(`${date}T00:00:00Z`).toISOString();
    const payload: NewWorkoutPayload = {
      date: isoDate,
      title: title.trim() || undefined,
      durationMin: editingWorkoutId
        ? durationMin || undefined
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
          sets: isCombo
            ? []
            : e.sets
                .filter((s) => s.validated)
                .map((s) => {
                  const mode = s.mode ?? (ex?.isStatic ? "hold" : "reps");
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

    if (editingWorkoutId) {
      updateWorkoutEntries.mutate(
        { id: editingWorkoutId, body: payload },
        {
          onSuccess: () => {
            draft.resetDraft();
            setEditingWorkoutId(null);
            useAppStore.getState().setView("history");
          },
          onError: (err) => {
            if (err instanceof QueuedOfflineError) {
              draft.resetDraft();
              setEditingWorkoutId(null);
              toast.success("Modifications mises en file d'attente — synchronisation au retour en ligne");
              useAppStore.getState().setView("history");
            }
          },
        },
      );
    } else {
      createWorkout.mutate(payload, {
        onSuccess: (data) => {
          const prs = computePRs(data, workoutsQ.data ?? [], exerciseMap);
          const totalVol = data.entries.reduce(
            (acc, e) => acc + e.sets.reduce((a, s) => a + (s.reps ?? s.holdSeconds ?? 0), 0),
            0,
          );
          const setsTotal = data.entries.reduce((acc, e) => acc + e.sets.length, 0);
          setSummaryData({
            title: data.title ?? "",
            date: fmtDate(data.date),
            durationMin: data.durationMin ?? 0,
            exertion: data.perceivedExertion ?? 0,
            bodyweight: data.bodyweightKg ?? "",
            entryCount: data.entries.length,
            totalSets: setsTotal,
            totalVolume: totalVol,
            prs,
          });
          setSummaryOpen(true);
        },
        onError: (err) => {
          if (err instanceof QueuedOfflineError) {
            draft.resetDraft();
            toast.success("Séance mise en file d'attente — synchronisation automatique au retour en ligne");
            useAppStore.getState().setView("dashboard");
          }
        },
      });
    }
  }

  function handleCancel() {
    draft.cancelSession();
    setCancelOpen(false);
    useAppStore.getState().setView("dashboard");
  }

  const saving = createWorkout.isPending || updateWorkoutEntries.isPending;

  return (
    <div className="pb-32">
      {/* ------------------- Sticky workout header ------------------- */}
      <div className="sticky top-0 z-30 -mx-3 mb-4 border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 text-muted-foreground"
            onClick={() => setDetailsOpen(true)}
            aria-label="Détails de la séance"
          >
            <Settings2 className="h-4.5 w-4.5" />
          </Button>

          <Input
            value={title}
            onChange={(e) => draft.setMeta("title", e.target.value)}
            placeholder="Titre de la séance"
            className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-1 text-base font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
            aria-label="Titre de la séance"
          />

          {sessionStartedAt != null && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-primary">
              <Clock className="h-3.5 w-3.5" />
              <LiveClock startedAt={sessionStartedAt} />
            </span>
          )}

          <Button
            size="sm"
            className="h-9 shrink-0 gap-1.5 bg-emerald-600 px-3 text-white hover:bg-emerald-700"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Terminer
          </Button>
        </div>

        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-muted-foreground">
          <span>{fmtDate(date, "EEEE d MMMM")}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{entries.length} exo</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            <span className="font-medium text-emerald-500">{validatedSets}</span>/{totalSets} séries
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{fmtCompact(totalVolume)} vol.</span>
        </div>
      </div>

      {/* ------------------- Quick actions ------------------- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => setPickerOpen(true)} className="h-10 flex-1 gap-2 sm:flex-none">
          <PlusCircle className="h-4 w-4" />
          Ajouter un exercice
        </Button>
        <Button variant="outline" onClick={() => setTemplatePickerOpen(true)} className="h-10 gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Template</span>
        </Button>
      </div>

      {/* ------------------- Entries ------------------- */}
      {entries.length === 0 ? (
        <EmptyState
          icon={PlusCircle}
          title="Séance vide"
          description="Ajoute ton premier exercice pour commencer. Tes valeurs de la dernière fois se rempliront automatiquement."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <PlusCircle className="h-4 w-4" />
              Ajouter un exercice
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const exercise = exerciseMap.get(entry.exerciseId);
            if (!exercise) return null;
            const prevEntry = idx > 0 ? entries[idx - 1] : null;
            const sameSupersetAsPrev = entry.supersetGroup != null && prevEntry?.supersetGroup === entry.supersetGroup;
            return (
              <EntryCard
                key={entry.id}
                entry={entry}
                exercise={exercise}
                defaultRestSec={defaultRestSec}
                isFirst={idx === 0}
                isLast={idx === entries.length - 1}
                supersetCount={entries.filter((e) => e.supersetGroup === entry.supersetGroup).length}
                isFirstOfSuperset={entry.supersetGroup != null && !sameSupersetAsPrev}
                allGroups={existingGroups}
                nextGroup={nextSupersetGroup(entries)}
                onChange={(patch) => draft.updateEntry(entry.id, patch)}
                onRemove={() => draft.removeEntry(entry.id)}
                onMoveEntry={(dir) => draft.moveEntry(entry.id, dir)}
                onAddSet={(defaults) => draft.addSet(entry.id, defaults)}
                onUpdateSet={(setId, patch) => draft.updateSet(entry.id, setId, patch)}
                onRemoveSet={(setId) => draft.removeSet(entry.id, setId)}
                onValidateSet={(setId, v) => draft.validateSet(entry.id, setId, v)}
                onSelectSuperset={(group) => draft.setSuperset(entry.id, group)}
                onAddComboStep={(step) => draft.addComboStep(entry.id, step)}
                onRemoveComboStep={(stepId) => draft.removeComboStep(entry.id, stepId)}
                onUpdateComboStep={(stepId, patch) => draft.updateComboStep(entry.id, stepId, patch)}
                onReorderComboStep={(stepId, dir) => draft.reorderComboStep(entry.id, stepId, dir)}
                onToggleComboValidated={() => {
                  const validating = !entry.comboValidated;
                  entry.comboSteps.forEach((step) =>
                    draft.updateComboStep(entry.id, step.id, { done: validating, failed: false }),
                  );
                  draft.toggleComboValidated(entry.id);
                }}
                onComboWeightKgChange={(v) => draft.updateEntry(entry.id, { comboWeightKg: v })}
                onComboRpeChange={(v) => draft.updateEntry(entry.id, { comboRpe: v })}
              />
            );
          })}
          <Button
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="h-11 w-full gap-2 border-dashed"
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter un exercice
          </Button>
        </div>
      )}

      {/* ------------------- Sticky bottom bar ------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} className="text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Annuler</span>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => useTimerStore.getState().start(defaultRestSec)}
            >
              <Timer className="h-4 w-4" />
              Repos {REST_PRESETS.find((p) => p.sec === defaultRestSec)?.label ?? `${defaultRestSec}s`}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-w-32 bg-emerald-600 text-white hover:bg-emerald-700">
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingWorkoutId ? "Mettre à jour" : "Terminer"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------- Details dialog ------------------- */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Détails de la séance
            </DialogTitle>
            <DialogDescription>Date, poids du corps, repos par défaut, effort et notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                    draft.setMeta("bodyweight", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Repos par défaut</Label>
              <div className="flex flex-wrap gap-1.5">
                {REST_PRESETS.map((p) => (
                  <Button
                    key={p.sec}
                    type="button"
                    size="sm"
                    variant={p.sec === defaultRestSec ? "default" : "outline"}
                    className="h-9 flex-1 tabular-nums"
                    onClick={() => draft.setMeta("defaultRestSec", p.sec)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Effort perçu</Label>
                <Badge variant="outline" className={cn("tabular-nums", exertionBadgeClass(exertion))}>
                  {exertion}/10
                </Badge>
              </div>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[exertion]}
                onValueChange={(v) => draft.setMeta("exertion", v[0] ?? 5)}
                className={sliderAccentClass(exertion)}
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

            {editingWorkoutId && (
              <div className="space-y-1.5">
                <Label htmlFor="nw-duration">Durée (min)</Label>
                <Input
                  id="nw-duration"
                  type="number"
                  min={0}
                  value={durationMin}
                  onChange={(e) =>
                    draft.setMeta("durationMin", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="—"
                  inputMode="numeric"
                  className="tabular-nums"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------- Cancel confirmation ------------------- */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner la séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les séries en cours seront perdues. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ------------------- Pickers ------------------- */}
      <ExercisePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={addEntry} />

      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Charger un template</DialogTitle>
            <DialogDescription>Pré-remplis ta séance à partir d'un template enregistré.</DialogDescription>
          </DialogHeader>
          {!templates || templates.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-center text-sm text-muted-foreground">Aucun template disponible.</p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setTemplatePickerOpen(false);
                  useAppStore.getState().viewTemplateEditor();
                }}
              >
                <PlusCircle className="h-4 w-4" />
                Créer un template
              </Button>
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleLoadTemplate(tpl.id)}
                  className="w-full rounded-lg border border-border/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{tpl.name}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {tpl.entries.length} exo
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {tpl.entries.slice(0, 5).map((e) => (
                      <span key={e.id} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {e.exercise.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <WorkoutSummaryModal
        open={summaryOpen}
        summary={summaryData}
        onClose={handleCloseSummary}
        onViewProgress={handleViewProgressFromSummary}
      />

      {showCheatsheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCheatsheet(false)}
        >
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">Raccourcis clavier ⌨️</h3>
            <div className="space-y-2 text-sm">
              {[
                ["Valider la série", "Entrée"],
                ["Lancer le repos", "R"],
                ["Ajouter une série", "⇧R"],
                ["Aide (ce menu)", "?"],
              ].map(([label, key]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-medium">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCheatsheet(false)}>
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
// Live clock
// ---------------------------------------------------------------------------
function LiveClock({ startedAt }: { startedAt: number }) {
  const [label, setLabel] = React.useState(() => sessionClock(startedAt));
  React.useEffect(() => {
    setLabel(sessionClock(startedAt));
    const id = setInterval(() => setLabel(sessionClock(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span>{label}</span>;
}

// ---------------------------------------------------------------------------
// EntryCard — Strong-style exercise card
// ---------------------------------------------------------------------------
function EntryCard({
  entry,
  exercise,
  defaultRestSec,
  isFirst,
  isLast,
  supersetCount,
  isFirstOfSuperset,
  allGroups,
  nextGroup,
  onChange,
  onRemove,
  onMoveEntry,
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
  isFirst: boolean;
  isLast: boolean;
  supersetCount: number;
  isFirstOfSuperset: boolean;
  allGroups: number[];
  nextGroup: number;
  onChange: (patch: Partial<DraftEntry>) => void;
  onRemove: () => void;
  onMoveEntry: (direction: "up" | "down") => void;
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
  const meta = getCatMeta(exercise.category as ExerciseCategory);

  const [historyByVariant, setHistoryByVariant] = React.useState<Record<string, HistorySet[]>>({});
  const historyRef = React.useRef<Record<string, HistorySet[]>>({});
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null);

  const sortedVariants = React.useMemo(
    () => (exercise.variants ? exercise.variants.slice().sort((a, b) => a.difficultyLevel - b.difficultyLevel) : []),
    [exercise.variants],
  );

  const activeVariantId = React.useMemo(
    () => sets.find((s) => s.variantId)?.variantId ?? sortedVariants[0]?.id ?? undefined,
    [sets, sortedVariants],
  );

  const loadHistory = React.useCallback(
    async (vid?: string, prefillFirst = false) => {
      if (!vid) return [];
      if (historyRef.current[vid]) return historyRef.current[vid];
      const hist = await fetchLastSession(exercise.id, vid);
      historyRef.current = { ...historyRef.current, [vid]: hist };
      setHistoryByVariant(historyRef.current);
      if (prefillFirst && hist[0]) {
        // Prefill the first (empty, unvalidated) set from last session — the
        // Strong behaviour: the numbers are already there when you open.
        const latest = useDraftStore.getState().entries.find((e) => e.id === entry.id);
        const first = latest?.sets[0];
        if (first && !first.validated && first.reps == null && first.holdSeconds == null) {
          const mode = first.mode ?? (exercise.isStatic ? "hold" : "reps");
          onUpdateSet(first.id, {
            weightKg: hist[0].weightKg ?? undefined,
            reps: mode === "reps" ? hist[0].reps ?? undefined : undefined,
            holdSeconds: mode === "hold" ? hist[0].holdSeconds ?? undefined : undefined,
          });
        }
      }
      return hist;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.id, entry.id],
  );

  React.useEffect(() => {
    loadHistory(activeVariantId ?? sortedVariants[0]?.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId, sortedVariants[0]?.id]);

  const ssColor = supersetColor(supersetGroup);
  const ssLabel = supersetLabel(supersetGroup);
  const inSuperset = supersetGroup != null;

  const lastSet = sets[sets.length - 1];

  function handleAddSet() {
    const defaults: Partial<DraftSet> = {};
    const vid = lastSet?.variantId ?? sortedVariants[0]?.id;
    if (vid) defaults.variantId = vid;
    if (lastSet?.mode) defaults.mode = lastSet.mode;
    // Copy the last set values (Strong: new set starts from the previous one).
    if (lastSet?.reps != null) defaults.reps = lastSet.reps;
    if (lastSet?.holdSeconds != null) defaults.holdSeconds = lastSet.holdSeconds;
    if (lastSet?.weightKg != null) defaults.weightKg = lastSet.weightKg;
    onAddSet(defaults);
  }

  async function handleVariantChange(newVariantId: string) {
    const newVariant = sortedVariants.find((v) => v.id === newVariantId);
    const newMode: "reps" | "hold" = (newVariant as unknown as { mode?: string })?.mode === "hold" ? "hold" : "reps";
    await loadHistory(newVariantId, true);
    // Apply the variant to every set of the entry (Strong keeps one variant per exercise).
    for (const s of sets) onUpdateSet(s.id, { variantId: newVariantId, mode: newMode });
  }

  function applyPrevious(setId: string, idx: number) {
    const hist = historyByVariant[activeVariantId ?? sortedVariants[0]?.id ?? ""] ?? [];
    const prev = hist[idx];
    if (!prev) return;
    const current = sets.find((s) => s.id === setId);
    const mode = current?.mode ?? (exercise.isStatic ? "hold" : "reps");
    onUpdateSet(setId, {
      mode,
      reps: mode === "reps" ? prev.reps ?? undefined : undefined,
      holdSeconds: mode === "hold" ? prev.holdSeconds ?? undefined : undefined,
      weightKg: prev.weightKg ?? undefined,
    });
  }

  const catColor = meta.color;

  return (
    <div
      data-entry-id={entry.id}
      className={cn("overflow-hidden rounded-xl border border-border/70 bg-card")}
      style={inSuperset && ssColor ? { borderLeftColor: ssColor, borderLeftWidth: 4 } : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <span aria-hidden className="text-base leading-none">{meta.emoji}</span>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{exercise.name}</h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${catColor}22`, color: catColor }}
        >
          {meta.label}
        </span>
        {inSuperset && ssColor && ssLabel && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-transparent text-[10px] font-bold"
            style={{ backgroundColor: `${ssColor}22`, color: ssColor }}
          >
            <Link2 className="h-3 w-3" />
            {ssLabel}
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!isFirst && (
              <DropdownMenuItem onClick={() => onMoveEntry("up")} className="gap-2">
                <ChevronRight className="h-4 w-4 -rotate-90" /> Monter
              </DropdownMenuItem>
            )}
            {!isLast && (
              <DropdownMenuItem onClick={() => onMoveEntry("down")} className="gap-2">
                <ChevronRight className="h-4 w-4 rotate-90" /> Descendre
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {inSuperset && (
              <DropdownMenuItem
                onClick={() => onSelectSuperset(null)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Link2Off className="h-4 w-4" /> Retirer du superset {supersetLabel(supersetGroup)}
              </DropdownMenuItem>
            )}
            {allGroups
              .filter((g) => g !== supersetGroup)
              .map((g) => (
                <DropdownMenuItem key={g} onClick={() => onSelectSuperset(g)} className="gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: supersetColor(g) ?? undefined }} />
                  Rejoindre superset {supersetLabel(g)}
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem onClick={() => onSelectSuperset(nextGroup)} className="gap-2">
              <Link2 className="h-4 w-4" /> Nouveau superset
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Retirer l'exercice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isFirstOfSuperset && supersetCount > 1 && ssColor && (
        <p className="px-3 pt-1 text-xs font-medium" style={{ color: ssColor }}>
          ↳ Superset {ssLabel} : enchaîne les {supersetCount - 1} exercice{supersetCount - 1 > 1 ? "s" : ""} suivant{supersetCount - 1 > 1 ? "s" : ""} sans repos.
        </p>
      )}

      <div className="space-y-2.5 px-3 py-3">
        <Input
          placeholder="Notes / indices d'exécution…"
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="h-9 text-sm"
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
            defaultRestSec={defaultRestSec}
          />
        ) : (
          <>
            {sortedVariants.length > 1 && (
              <select
                value={activeVariantId ?? ""}
                onChange={(e) => handleVariantChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-background px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                aria-label={`Variante pour ${exercise.name}`}
              >
                {sortedVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {difficultyStars(v.difficultyLevel)}
                  </option>
                ))}
              </select>
            )}

            {/* Column header */}
            <div className="grid grid-cols-[26px_58px_minmax(0,1fr)_minmax(0,1fr)_56px] items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="text-center">#</span>
              <span>Préc.</span>
              <span className="text-center">KG</span>
              <span className="text-center">{exercise.isStatic ? "Sec" : "Reps"}</span>
              <span />
            </div>

            {sets.map((set, idx) => (
              <SetRow
                key={set.id}
                set={set}
                idx={idx}
                isStatic={exercise.isStatic}
                defaultRestSec={defaultRestSec}
                previous={previousLabel(
                  historyByVariant[set.variantId ?? activeVariantId ?? ""]?.[idx],
                  set.mode ?? (exercise.isStatic ? "hold" : "reps"),
                )}
                onUpdate={(patch) => onUpdateSet(set.id, patch)}
                onValidate={(v) => onValidateSet(set.id, v)}
                onApplyPrevious={() => applyPrevious(set.id, idx)}
                onRequestDelete={() => setPendingDelete(set.id)}
              />
            ))}

            <Button variant="outline" size="sm" className="mt-1 h-10 w-full gap-2" onClick={handleAddSet}>
              <Plus className="h-4 w-4" />
              Ajouter une série
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette série ?</AlertDialogTitle>
            <AlertDialogDescription>Cette série sera retirée de la séance en cours.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onRemoveSet(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SetRow — one big, thumb-friendly set line
// ---------------------------------------------------------------------------
function SetRow({
  set,
  idx,
  isStatic,
  defaultRestSec,
  previous,
  onUpdate,
  onValidate,
  onApplyPrevious,
  onRequestDelete,
}: {
  set: DraftSet;
  idx: number;
  isStatic: boolean;
  defaultRestSec: number;
  previous: string | null;
  onUpdate: (patch: Partial<DraftSet>) => void;
  onValidate: (validated: boolean) => void;
  onApplyPrevious: () => void;
  onRequestDelete: () => void;
}) {
  const validated = set.validated;
  const mode = set.mode ?? (isStatic ? "hold" : "reps");

  function handleValidate() {
    const next = !validated;
    if (next) playChime();
    onValidate(next);
    if (next && defaultRestSec > 0) useTimerStore.getState().start(defaultRestSec);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[26px_58px_minmax(0,1fr)_minmax(0,1fr)_56px] items-center gap-1.5 rounded-lg border px-0.5 py-1 transition-colors",
        validated ? "border-emerald-500/40 bg-emerald-500/10" : "border-transparent bg-muted/30",
      )}
    >
      <span className="text-center text-sm font-semibold tabular-nums text-muted-foreground">{idx + 1}</span>

      {previous ? (
        <button
          type="button"
          onClick={onApplyPrevious}
          className="truncate rounded border border-transparent px-1 py-1 text-xs tabular-nums text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted hover:text-foreground"
          title="Reprendre la valeur précédente"
          aria-label={`Reprendre la valeur précédente de la série ${idx + 1}`}
        >
          {previous}
        </button>
      ) : (
        <span className="text-center text-xs text-muted-foreground/40">—</span>
      )}

      <ValueInput
        value={set.weightKg}
        placeholder="0"
        step={0.5}
        ariaLabel={`Poids série ${idx + 1}`}
        onChange={(n) => onUpdate({ weightKg: n })}
      />

      <ValueInput
        value={mode === "reps" ? set.reps : set.holdSeconds}
        placeholder={mode === "hold" ? "30" : "8"}
        ariaLabel={`${mode === "hold" ? "Maintien" : "Reps"} série ${idx + 1}`}
        onChange={(n) => onUpdate(mode === "reps" ? { reps: n } : { holdSeconds: n })}
      />

      <button
        type="button"
        onClick={handleValidate}
        onContextMenu={(e) => {
          e.preventDefault();
          onRequestDelete();
        }}
        aria-label={validated ? `Série ${idx + 1} faite` : `Marquer la série ${idx + 1} comme faite`}
        aria-pressed={validated}
        className={cn(
          "flex h-11 w-11 items-center justify-center justify-self-end rounded-full border-2 transition-all active:scale-95",
          validated
            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
            : "border-border bg-background text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-500",
        )}
      >
        <Check className={cn("h-5 w-5", validated && "scale-110")} />
      </button>
    </div>
  );
}

function ValueInput({
  value,
  placeholder,
  step,
  ariaLabel,
  onChange,
}: {
  value: number | undefined;
  placeholder?: string;
  step?: number;
  ariaLabel: string;
  onChange: (n: number | undefined) => void;
}) {
  const [draft, setDraft] = React.useState<string>(value == null ? "" : String(value));
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setDraft(value == null ? "" : String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(value == null ? "" : String(value));
      }}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        setDraft(v);
        if (v === "") {
          onChange(undefined);
          return;
        }
        const n = Number(v);
        if (!Number.isNaN(n)) onChange(n);
      }}
      aria-label={ariaLabel}
      className="mx-auto h-11 w-full min-w-0 max-w-[170px] rounded-lg border border-border/60 bg-background px-2 text-center text-base font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/40"
    />
  );
}

// ---------------------------------------------------------------------------
// Fallback export name so existing imports keep working if any remain.
// ---------------------------------------------------------------------------
export { ActiveWorkoutView as NewWorkoutView };
