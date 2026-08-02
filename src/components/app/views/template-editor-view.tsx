"use client";

import * as React from "react";
import {
  Plus,
  PlusCircle,
  Trash2,
  Save,
  ArrowLeft,
  Dumbbell,
  ChevronUp,
  ChevronDown,
  Link2,
  Link2Off,
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
import { difficultyStars, supersetLabel, supersetColor } from "@/lib/calc";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function makeDefaultSet(
  exercise: ExerciseWithVariants,
  prev?: EditorSet,
): EditorSet {
  const firstVariant = exercise.variants
    ?.slice()
    .sort((a, b) => a.difficultyLevel - b.difficultyLevel)[0];
  const firstVariantId = prev?.variantId ?? firstVariant?.id ?? null;
  const variantMode = (firstVariant as unknown as { mode?: string })?.mode;
  return {
    id: uid(),
    isHold: variantMode === "hold" ? true : variantMode === "reps" ? false : exercise.isStatic,
    variantId: firstVariantId,
    targetReps: prev?.targetReps ?? undefined,
    targetHoldSeconds: prev?.targetHoldSeconds ?? undefined,
    targetWeightKg: prev?.targetWeightKg ?? undefined,
    targetRpe: prev?.targetRpe ?? undefined,
  };
}

function tplNextSupersetGroup(entries: EditorEntry[]): number {
  const used = new Set(
    entries.map((e) => e.supersetGroup).filter((g): g is number => g != null),
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function tplUsedSupersetGroups(entries: EditorEntry[]): number[] {
  const used = new Set(
    entries.map((e) => e.supersetGroup).filter((g): g is number => g != null),
  );
  return Array.from(used).sort((a, b) => a - b);
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
              data.entries?.map((e: Record<string, unknown>) => {
                const ex = exerciseMap.get(e.exerciseId as string);
                const sortedVar = ex?.variants
                  ?.slice()
                  .sort((a, b) => a.difficultyLevel - b.difficultyLevel);
                return {
                  id: uid(),
                  exerciseId: e.exerciseId as string,
                  supersetGroup: (e.supersetGroup as number) ?? null,
                  notes: (e.notes as string) ?? "",
                  sets: ((e.sets as Array<Record<string, unknown>>) ?? []).map(
                    (s, _si, arr) => {
                      const prev = _si > 0 ? arr[_si - 1] : undefined;
                      const vId = (s.variantId as string) ??
                        (prev?.variantId as string | undefined) ??
                        (e.variantId as string | undefined) ??
                        sortedVar?.[0]?.id ??
                        null;
                      const matchedVariant = sortedVar?.find((v) => v.id === vId);
                      const variantMode = (matchedVariant as unknown as { mode?: string })?.mode;
                      return {
                        id: uid(),
                        isHold: variantMode === "hold" ? true : variantMode === "reps" ? false : (ex?.isStatic ?? false),
                        variantId: vId,
                        targetReps: s.targetReps as number | undefined,
                        targetHoldSeconds:
                          s.targetHoldSeconds as number | undefined,
                        targetWeightKg: s.targetWeightKg as number | undefined,
                        targetRpe: s.targetRpe as number | undefined,
                      };
                    },
                  ),
                  comboSteps: (Array.isArray(e.comboSteps) ? e.comboSteps : []) as ComboStep[],
                };
              }),
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

  function moveEntry(id: string, direction: "up" | "down") {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
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

  function setSupersetGroup(entryId: string, group: number | null) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, supersetGroup: group } : e,
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
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6 pb-24">
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
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight">
            {templateEditorId ? "Modifier le template" : "Nouveau template"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Prépare ta séance à l&apos;avance
          </p>
        </div>
      </div>

      {/* Template name */}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du template (ex. Push max)"
        className="h-9 text-sm font-medium"
      />

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optionnel)"
        className="min-h-[48px] resize-none text-sm"
      />

      <Separator />

      {/* Entries */}
      <div className="space-y-3">
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
          entries.map((e, idx) => {
            const ex = exerciseMap.get(e.exerciseId);
            if (!ex) return null;
            const cat = ex.category as ExerciseCategory;
            const meta = getCatMeta(cat);
            const isStatic = ex.isStatic;
            const sortedVariants = ex.variants
              ?.slice()
              .sort((a, b) => a.difficultyLevel - b.difficultyLevel);
            const entryId = e.id;
            const ssGroup = e.supersetGroup;
            const ssLabel = supersetLabel(ssGroup);
            const ssColor = supersetColor(ssGroup);
            const inSuperset = ssGroup != null;
            const existingGroups = tplUsedSupersetGroups(entries);
            const nextGroup = tplNextSupersetGroup(entries);
            return (
               <Card
                 key={entryId}
                 className={cn(
                   inSuperset && "shadow-sm",
                 )}
                 style={
                   inSuperset && ssColor
                     ? { borderLeftColor: ssColor, borderLeftWidth: 4 }
                     : undefined
                 }
               >
                  <CardHeader className="pb-0.5 pt-1.5">
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex min-w-0 flex-wrap items-center gap-2">
                       <span aria-hidden className="text-sm leading-none">
                         {meta.emoji}
                       </span>
                       <CardTitle className="truncate text-sm">
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
                       {inSuperset && ssColor && ssLabel && (
                         <Badge
                           variant="outline"
                           className="gap-1 border-transparent text-[10px] font-bold"
                           style={{ backgroundColor: `${ssColor}22`, color: ssColor }}
                         >
                           <Link2 className="h-3 w-3" />
                           Superset {ssLabel}
                         </Badge>
                       )}
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
                      </div>
                      <div className="flex items-center gap-0.5">
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
                                onClick={() => setSupersetGroup(entryId, null)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Link2Off className="h-4 w-4" />
                                Retirer du superset {supersetLabel(ssGroup)}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {existingGroups
                            .filter((g) => g !== ssGroup)
                            .map((g) => (
                              <DropdownMenuItem
                                key={g}
                                onClick={() => setSupersetGroup(entryId, g)}
                                className="gap-2"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: supersetColor(g) }}
                                />
                                Superset {supersetLabel(g)}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuItem
                            onClick={() => setSupersetGroup(entryId, nextGroup)}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Nouveau superset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {idx > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveEntry(entryId, "up")}
                          aria-label="Monter l'exercice"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      )}
                      {idx < entries.length - 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => moveEntry(entryId, "down")}
                          aria-label="Descendre l'exercice"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      )}
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
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
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
                      defaultRestSec={90}
                    />
                  ) : (
                    <>
                      {/* Desktop: inline table */}
                      <div className="hidden sm:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase text-muted-foreground">
                              <th className="w-10 pb-2 text-left font-medium">#</th>
                              <th className="w-[30%] pb-2 text-left font-medium">Valeur</th>
                              {sortedVariants && sortedVariants.length > 1 && (
                                <th className="w-40 pb-2 text-left font-medium">Variante</th>
                              )}
                              <th className="w-[24%] pb-2 text-left font-medium">KG</th>
                              <th className="w-10 pb-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {e.sets.map((s, sIdx) => {
                              const isHold = s.isHold ?? isStatic;
                              const mode = isHold ? "hold" : "reps";
                              const metricValue =
                                mode === "reps"
                                  ? s.targetReps
                                  : s.targetHoldSeconds;
                              return (
                                <tr key={s.id} className="border-t border-border/50">
                                  <td className="py-1.5 text-muted-foreground tabular-nums w-10">{sIdx + 1}</td>
                                  <td className="py-1.5 pr-2">
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder={mode === "hold" ? "30" : "8"}
                                        value={metricValue ?? ""}
                                        aria-label={`${mode === "hold" ? "Maintien" : "Reps"} série ${sIdx + 1}`}
                                        onFocus={(e) => e.target.select()}
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
                                        className="h-8 w-16 tabular-nums"
                                      />
                                      <span className="text-[9px] font-bold uppercase text-muted-foreground/50 tabular-nums shrink-0">
                                        {mode === "hold" ? "sec" : "reps"}
                                      </span>
                                    </div>
                                  </td>
                                  {sortedVariants && sortedVariants.length > 1 && (
                                    <td className="py-1.5 pr-2">
                                      <select
                                        value={s.variantId ?? sortedVariants[0]?.id ?? ""}
                                        onChange={(ev) => {
                                          const newVariantId = ev.target.value || null;
                                          const selectedVariant = sortedVariants.find(
                                            (v) => v.id === newVariantId,
                                          );
                                          const variantMode = (selectedVariant as unknown as { mode?: string })?.mode;
                                          updateSet(entryId, s.id, {
                                            variantId: newVariantId,
                                            isHold: variantMode === "hold" ? true : variantMode === "reps" ? false : isStatic,
                                          });
                                        }}
                                        className="h-8 w-full rounded-md border border-border/60 bg-background px-1.5 text-[11px] tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring"
                                        aria-label={`Variante série ${sIdx + 1}`}
                                      >
                                        {sortedVariants.map((v) => (
                                          <option key={v.id} value={v.id}>
                                            {v.name} {difficultyStars(v.difficultyLevel)}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  )}
                                  <td className="py-1.5 pr-2">
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      step={0.5}
                                      placeholder="0"
                                      value={s.targetWeightKg ?? ""}
                                      aria-label={`Poids série ${sIdx + 1}`}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(ev) => {
                                        const v =
                                          ev.target.value === ""
                                            ? undefined
                                            : Number(ev.target.value) || undefined;
                                        updateSet(entryId, s.id, {
                                          targetWeightKg: v,
                                        });
                                      }}
                                      className="h-8 w-16 tabular-nums"
                                    />
                                  </td>
                                  <td className="py-1.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeSet(entryId, s.id)}
                                      aria-label={`Supprimer la série ${sIdx + 1}`}
                                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: 2-line grid rows */}
                      <div className="sm:hidden space-y-1.5">
                        {e.sets.length > 0 && (
                          <div className="grid grid-cols-[20px_1fr_24px_1fr_32px] items-center gap-0.5 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="text-center">#</span>
                            <span className="text-center">Valeur</span>
                            <span />
                            <span className="text-center">KG</span>
                            <span />
                          </div>
                        )}
                        {e.sets.map((s, sIdx) => {
                          const isHold = s.isHold ?? isStatic;
                          const mode = isHold ? "hold" : "reps";
                          const metricValue =
                            mode === "reps"
                              ? s.targetReps
                              : s.targetHoldSeconds;
                          return (
                            <div key={s.id} className="space-y-1">
                              <div className="grid grid-cols-[20px_1fr_24px_1fr_32px] items-center gap-0.5 rounded-md bg-muted/30 px-1 py-1">
                                <span className="text-center text-xs font-semibold tabular-nums text-muted-foreground">
                                  {sIdx + 1}
                                </span>
                                <Input
                                  type="text"
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
                                  onFocus={(e) => e.target.select()}
                                  className="h-8 w-full text-center text-sm tabular-nums"
                                />
                                <span className="text-[9px] font-bold uppercase text-muted-foreground/50 text-center leading-none">
                                  {mode === "hold" ? "sec" : "reps"}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  step={0.5}
                                  placeholder="kg"
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
                                  onFocus={(e) => e.target.select()}
                                  className="h-8 w-full text-center text-sm tabular-nums"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeSet(entryId, s.id)}
                                  aria-label={`Supprimer la série ${sIdx + 1}`}
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              {sortedVariants && sortedVariants.length > 1 && (
                                <select
                                  value={s.variantId ?? sortedVariants[0]?.id ?? ""}
                                  onChange={(ev) => {
                                    const newVariantId = ev.target.value || null;
                                    const selectedVariant = sortedVariants.find(
                                      (v) => v.id === newVariantId,
                                    );
                                    const variantMode = (selectedVariant as unknown as { mode?: string })?.mode;
                                    updateSet(entryId, s.id, {
                                      variantId: newVariantId,
                                      isHold: variantMode === "hold" ? true : variantMode === "reps" ? false : isStatic,
                                    });
                                  }}
                                  className="w-full h-7 rounded border border-border/60 bg-background px-2 text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-ring truncate"
                                  aria-label={`Variante série ${sIdx + 1}`}
                                >
                                  {sortedVariants.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.name} {difficultyStars(v.difficultyLevel)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
        <div className="sticky bottom-4 z-30">
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 px-3 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <span className="text-xs text-muted-foreground">
              {entries.length} exercice{entries.length > 1 ? "s" : ""}
            </span>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="gap-2"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Enregistrer le template
                </>
              )}
            </Button>
          </div>
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
