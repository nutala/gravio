"use client";

import * as React from "react";
import {
  Plus,
  PlusCircle,
  Trash2,
  Save,
  ArrowLeft,
  Dumbbell,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useExercises, useSaveTemplate } from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import { useCategoryMeta } from "@/hooks/use-data";
import type {
  ExerciseWithVariants,
  ExerciseCategory,
  ComboStep,
} from "@/lib/types";
import { difficultyStars } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/app/common";
import { ExercisePickerDialog } from "@/components/app/exercise-picker-dialog";
import { ComboEditor } from "@/components/app/combo-editor";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EditorSet {
  id: string;
  isHold?: boolean;
  variantId?: string | null;
  targetReps?: number;
  targetHoldSeconds?: number;
  targetWeightKg?: number;
  targetRpe?: number;
}

interface EditorEntry {
  id: string;
  exerciseId: string;
  supersetGroup: number | null;
  notes: string;
  sets: EditorSet[];
  comboSteps: ComboStep[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _eid = 0;
function uid() {
  _eid++;
  return `te-${_eid}-${Math.random().toString(36).slice(2, 6)}`;
}

function firstVariantId(exercise: ExerciseWithVariants): string | null {
  const sorted = exercise.variants
    ?.slice()
    .sort((a, b) => a.difficultyLevel - b.difficultyLevel);
  return sorted?.[0]?.id ?? null;
}

function makeDefaultSet(
  exercise: ExerciseWithVariants,
  prev?: EditorSet,
): EditorSet {
  return {
    id: uid(),
    isHold: exercise.isStatic,
    variantId: prev?.variantId ?? firstVariantId(exercise),
    targetReps: prev?.targetReps ?? undefined,
    targetHoldSeconds: prev?.targetHoldSeconds ?? undefined,
    targetWeightKg: prev?.targetWeightKg ?? undefined,
    targetRpe: prev?.targetRpe ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  View                                                               */
/* ------------------------------------------------------------------ */

export function TemplateEditorView() {
  const { closeTemplateEditor, templateEditorId } = useAppStore();
  const { data: exercises } = useExercises();
  const saveTemplate = useSaveTemplate();
  const getCatMeta = useCategoryMeta();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [entries, setEntries] = React.useState<EditorEntry[]>([]);

  const exerciseMap = React.useMemo(() => {
    const m = new Map<string, ExerciseWithVariants>();
    for (const ex of exercises ?? []) m.set(ex.id, ex);
    return m;
  }, [exercises]);

  /* Load existing template for editing */
  const loaded = React.useRef(false);
  React.useEffect(() => {
    if (templateEditorId && exercises && !loaded.current) {
      fetch(`/api/templates/${templateEditorId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.name) {
            setName(data.name ?? "");
            setNotes(data.notes ?? "");
            setEntries(
              data.entries?.map((e: Record<string, unknown>) => ({
                id: uid(),
                exerciseId: e.exerciseId as string,
                supersetGroup: (e.supersetGroup as number) ?? null,
                notes: (e.notes as string) ?? "",
                sets: ((e.sets as Array<Record<string, unknown>>) ?? []).map(
                  (s, _si, arr) => {
                    const prev = _si > 0 ? arr[_si - 1] : undefined;
                    return {
                      id: uid(),
                      isHold: (s.isHold as boolean) ?? false,
                      variantId:
                        (s.variantId as string) ??
                        (prev?.variantId as string | undefined) ??
                        null,
                      targetReps: s.targetReps as number | undefined,
                      targetHoldSeconds:
                        s.targetHoldSeconds as number | undefined,
                      targetWeightKg: s.targetWeightKg as number | undefined,
                      targetRpe: s.targetRpe as number | undefined,
                    };
                  },
                ),
                comboSteps: (Array.isArray(e.comboSteps) ? e.comboSteps : []) as ComboStep[],
              })),
            );
          }
          loaded.current = true;
        })
        .catch(() => {
          toast.error("Impossible de charger le template");
        });
    }
  }, [templateEditorId, exercises]);

  /* Reset when creating new */
  React.useEffect(() => {
    if (!templateEditorId) {
      loaded.current = false;
      setName("");
      setNotes("");
      setEntries([]);
    }
  }, [templateEditorId]);

  function handlePickExercise(ex: ExerciseWithVariants) {
    const isCombo = ex.name === "Combos";
    setEntries((prev) => [
      ...prev,
      {
        id: uid(),
        exerciseId: ex.id,
        supersetGroup: null,
        notes: "",
        sets: isCombo ? [] : [makeDefaultSet(ex)],
        comboSteps: [],
      },
    ]);
    setPickerOpen(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function addSet(entryId: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const ex = exerciseMap.get(e.exerciseId);
        if (!ex) return e;
        const lastSet = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [...e.sets, makeDefaultSet(ex, lastSet)],
        };
      }),
    );
  }

  function updateSet(
    entryId: string,
    setId: string,
    patch: Partial<EditorSet>,
  ) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
            }
          : e,
      ),
    );
  }

  function removeSet(entryId: string, setId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
          : e,
      ),
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Le nom du template est obligatoire");
      return;
    }
    if (entries.length === 0) {
      toast.error("Ajoute au moins un exercice");
      return;
    }
    setSaving(true);
    try {
      await saveTemplate.mutateAsync({
        id: templateEditorId ?? undefined,
        name: trimmedName,
        notes: notes || undefined,
        entries: entries.map((e) => {
          const ex = exerciseMap.get(e.exerciseId);
          const isCombo = ex?.name === "Combos" || e.comboSteps.length > 0;
          return {
          exerciseId: e.exerciseId,
          variantId: null,
          supersetGroup: e.supersetGroup,
          notes: e.notes || undefined,
          comboSteps: isCombo ? e.comboSteps : undefined,
          sets: e.sets.map((s) => ({
            isHold: s.isHold ?? false,
            variantId: s.variantId || null,
            targetReps: s.targetReps,
            targetHoldSeconds: s.targetHoldSeconds,
            targetWeightKg: s.targetWeightKg,
            targetRpe: s.targetRpe,
          })),
          };
        }),
      });
      closeTemplateEditor();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={closeTemplateEditor}
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">
            {templateEditorId ? "Modifier le template" : "Nouveau template"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Prépare ta séance à l&apos;avance
          </p>
        </div>
      </div>

      {/* Template name */}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du template (ex. Push max)"
        className="h-10 text-base font-medium"
      />

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optionnel)"
        className="min-h-[60px] resize-none"
      />

      <Separator />

      {/* Entries */}
      <div className="space-y-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Aucun exercice"
            description="Ajoute des exercices pour construire ton template."
            action={
              <Button onClick={() => setPickerOpen(true)}>
                <PlusCircle className="h-4 w-4" />
                Ajouter un exercice
              </Button>
            }
          />
        ) : (
          entries.map((e) => {
            const ex = exerciseMap.get(e.exerciseId);
            if (!ex) return null;
            const cat = ex.category as ExerciseCategory;
            const meta = getCatMeta(cat);
            const isStatic = ex.isStatic;
            const sortedVariants = ex.variants
              ?.slice()
              .sort((a, b) => a.difficultyLevel - b.difficultyLevel);
            const entryId = e.id;
            return (
              <Card key={entryId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span aria-hidden className="text-base leading-none">
                        {meta.emoji}
                      </span>
                      <CardTitle className="truncate text-base">
                        {ex.name}
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
                      {(ex as unknown as { tags: string[] }).tags?.map((tag) => {
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
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeEntry(entryId)}
                      aria-label={`Retirer ${ex.name}`}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {(ex?.name === "Combos" || e.comboSteps.length > 0) ? (
                    <ComboEditor
                      steps={e.comboSteps}
                      validated={false}
                      onAddStep={(step) =>
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.id === entryId
                              ? { ...en, comboSteps: [...en.comboSteps, step] }
                              : en,
                          ),
                        )
                      }
                      onRemoveStep={(stepId) =>
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.id === entryId
                              ? { ...en, comboSteps: en.comboSteps.filter((s) => s.id !== stepId) }
                              : en,
                          ),
                        )
                      }
                      onUpdateStep={(stepId, patch) =>
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.id === entryId
                              ? {
                                  ...en,
                                  comboSteps: en.comboSteps.map((s) =>
                                    s.id === stepId ? { ...s, ...patch } : s,
                                  ),
                                }
                              : en,
                          ),
                        )
                      }
                      onReorderStep={(stepId, direction) =>
                        setEntries((prev) => {
                          const ent = prev.find((en) => en.id === entryId);
                          if (!ent) return prev;
                          const idx = ent.comboSteps.findIndex((s) => s.id === stepId);
                          if (idx === -1) return prev;
                          if (direction === "up" && idx === 0) return prev;
                          if (direction === "down" && idx === ent.comboSteps.length - 1) return prev;
                          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
                          const next = [...ent.comboSteps];
                          [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
                          return prev.map((en) =>
                            en.id === entryId ? { ...en, comboSteps: next } : en,
                          );
                        })
                      }
                    />
                  ) : (
                    <>
                      {e.sets.map((s, idx) => {
                        const isHold = s.isHold ?? isStatic;
                        const mode = isHold ? "hold" : "reps";
                        const otherMode = mode === "reps" ? "hold" : "reps";
                        const metricValue =
                          mode === "reps"
                            ? s.targetReps
                            : s.targetHoldSeconds;
                        return (
                          <div
                            key={s.id}
                            className="rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                                Série {idx + 1}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeSet(entryId, s.id)}
                                aria-label={`Supprimer la série ${idx + 1}`}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                {!isStatic && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSet(entryId, s.id, {
                                        isHold: mode !== "hold",
                                      })
                                    }
                                    className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                                    aria-label={`Passer en ${otherMode === "reps" ? "répétitions" : "maintien (s)"}`}
                                  >
                                    {mode === "reps" ? "Reps" : "Maintien (s)"}
                                  </button>
                                )}
                                {isStatic && (
                                  <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Maintien (s)
                                  </span>
                                )}
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder={mode === "hold" ? "30" : "8"}
                                  value={metricValue ?? ""}
                                  onChange={(ev) => {
                                    const v =
                                      ev.target.value === ""
                                        ? undefined
                                        : Number(ev.target.value) || undefined;
                                    updateSet(entryId, s.id, {
                                      ...(mode === "reps"
                                        ? { targetReps: v, targetHoldSeconds: undefined }
                                        : { targetHoldSeconds: v, targetReps: undefined }),
                                    });
                                  }}
                                  className="h-9 tabular-nums"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Poids (kg)
                                </span>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={s.targetWeightKg ?? ""}
                                  onChange={(ev) => {
                                    const v =
                                      ev.target.value === ""
                                        ? undefined
                                        : Number(ev.target.value) || undefined;
                                    updateSet(entryId, s.id, {
                                      targetWeightKg: v,
                                    });
                                  }}
                                  className="h-9 tabular-nums"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  RPE
                                </span>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={1}
                                  max={10}
                                  placeholder="7"
                                  value={s.targetRpe ?? ""}
                                  onChange={(ev) => {
                                    const v =
                                      ev.target.value === ""
                                        ? undefined
                                        : Number(ev.target.value) || undefined;
                                    updateSet(entryId, s.id, {
                                      targetRpe: v,
                                    });
                                  }}
                                  className="h-9 tabular-nums"
                                />
                              </div>
                            </div>

                            {sortedVariants && sortedVariants.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Variante
                                </span>
                                <select
                                  value={
                                    s.variantId ?? sortedVariants[0]?.id ?? ""
                                  }
                                  onChange={(ev) =>
                                    updateSet(entryId, s.id, {
                                      variantId: ev.target.value || null,
                                    })
                                  }
                                  className="h-7 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-1.5 text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring"
                                >
                                  {sortedVariants.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.name} {difficultyStars(v.difficultyLevel)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSet(entryId)}
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une série
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add exercise button */}
      {entries.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter un exercice
          </Button>
        </div>
      )}

      {/* Bottom: Save button */}
      {entries.length > 0 && (
        <div className="flex justify-center pb-8">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="gap-2 px-8"
          >
            <Save className="h-4 w-4" />
            Enregistrer le template
          </Button>
        </div>
      )}

      {/* Exercise picker */}
      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePickExercise}
      />
    </div>
  );
}
