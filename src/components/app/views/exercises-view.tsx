"use client";

import * as React from "react";
import {
  Dumbbell,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Clock,
  Repeat,
  Star,
  Target,
  Palette,
  FileText,
} from "lucide-react";

import {
  type ExerciseCategory,
  type ExerciseWithVariants,
  type ExerciseVariant,
} from "@/lib/types";
import { metricUnit, difficultyStars } from "@/lib/calc";
import {
  useExercises,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
  useAddVariant,
  useUpdateVariant,
  useDeleteVariant,
  useCategories,
  useCategoryMeta,
  useWorkouts,
} from "@/hooks/use-data";
import { CategoryManagerDialog } from "@/components/app/category-manager-dialog";
import { EmptyState, SectionHeading } from "@/components/app/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

/* ------------------------------------------------------------------ */
/* Form state types                                                   */
/* ------------------------------------------------------------------ */

interface ExerciseFormState {
  name: string;
  category: ExerciseCategory;
  tags: string[];
  muscleGroup: string;
  isStatic: boolean;
  description: string;
  equipment: string;
}

interface VariantFormState {
  name: string;
  difficultyLevel: number;
  targetValue: number;
  description: string;
}

const EMPTY_EXERCISE_FORM: ExerciseFormState = {
  name: "",
  category: "Push",
  tags: [],
  muscleGroup: "Corps complet",
  isStatic: false,
  description: "",
  equipment: "",
};

const EMPTY_VARIANT_FORM: VariantFormState = {
  name: "",
  difficultyLevel: 1,
  targetValue: 0,
  description: "",
};

/* ------------------------------------------------------------------ */
/* Main view                                                          */
/* ------------------------------------------------------------------ */

export function ExercisesView() {
  const { data: exercises, isLoading } = useExercises();
  const { data: categoryList } = useCategories();
  const getCatMeta = useCategoryMeta();
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();
  const addVariant = useAddVariant();
  const updateVariant = useUpdateVariant();
  const deleteVariant = useDeleteVariant();
  const workoutsQ = useWorkouts();

  // Dynamic category list (fall back to empty array while loading).
  const categories: ExerciseCategory[] = React.useMemo(
    () => (categoryList ?? []).map((c) => c.name),
    [categoryList],
  );

  // Filters
  const [search, setSearch] = React.useState("");
  const [activeCategories, setActiveCategories] = React.useState<Set<ExerciseCategory>>(
    new Set(),
  );

  // Category manager dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);

  // Exercise dialog state
  const [exerciseDialogOpen, setExerciseDialogOpen] = React.useState(false);
  const [editingExercise, setEditingExercise] =
    React.useState<ExerciseWithVariants | null>(null);

  // Delete exercise dialog
  const [deletingExercise, setDeletingExercise] =
    React.useState<ExerciseWithVariants | null>(null);

  // Variant dialog state
  const [variantDialogOpen, setVariantDialogOpen] = React.useState(false);
  const [variantContext, setVariantContext] = React.useState<{
    exerciseId: string;
    isStatic: boolean;
    variant: ExerciseVariant | null;
  } | null>(null);

  // Delete variant dialog
  const [deletingVariant, setDeletingVariant] = React.useState<{
    exerciseId: string;
    variant: ExerciseVariant;
  } | null>(null);

  /* ----- filter logic ----- */
  const filtered = React.useMemo(() => {
    if (!exercises) return [];
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesSearch =
        !q || ex.name.toLowerCase().includes(q) || (ex.muscleGroup ?? "").toLowerCase().includes(q);
      const exTags = (ex as unknown as { tags: string[] }).tags ?? [];
      const matchesCategory =
        activeCategories.size === 0 ||
        activeCategories.has(ex.category as ExerciseCategory) ||
        exTags.some((t) => activeCategories.has(t as ExerciseCategory));
      return matchesSearch && matchesCategory;
    });
  }, [exercises, search, activeCategories]);

  const grouped = React.useMemo(() => {
    const map = new Map<ExerciseCategory, ExerciseWithVariants[]>();
    for (const cat of categories) map.set(cat, []);
    for (const ex of filtered) {
      const cat = ex.category as ExerciseCategory;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ex);
    }
    return map;
  }, [filtered, categories]);

  const totalCount = filtered.length;

  const toggleCategory = (cat: ExerciseCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  /* ----- exercise form handlers ----- */
  const openCreateExercise = () => {
    setEditingExercise(null);
    setExerciseDialogOpen(true);
  };

  const openEditExercise = (ex: ExerciseWithVariants) => {
    setEditingExercise(ex);
    setExerciseDialogOpen(true);
  };

  const submitExercise = (form: ExerciseFormState) => {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      tags: form.tags,
      muscleGroup: form.muscleGroup.trim() || "Corps complet",
      isStatic: form.isStatic,
      description: form.description.trim() ? form.description.trim() : null,
      equipment: form.equipment.trim() ? form.equipment.trim() : null,
    };
    if (editingExercise) {
      updateExercise.mutate({ id: editingExercise.id, body: payload });
    } else {
      createExercise.mutate(payload);
    }
    setExerciseDialogOpen(false);
    setEditingExercise(null);
  };

  const confirmDeleteExercise = () => {
    if (!deletingExercise) return;
    deleteExercise.mutate(deletingExercise.id);
    setDeletingExercise(null);
  };

  /* ----- variant form handlers ----- */
  const openAddVariant = (exerciseId: string, isStatic: boolean) => {
    setVariantContext({ exerciseId, isStatic, variant: null });
    setVariantDialogOpen(true);
  };

  const openEditVariant = (
    exerciseId: string,
    isStatic: boolean,
    variant: ExerciseVariant,
  ) => {
    setVariantContext({ exerciseId, isStatic, variant });
    setVariantDialogOpen(true);
  };

  const submitVariant = (form: VariantFormState) => {
    if (!variantContext) return;
    const { exerciseId, variant } = variantContext;
    const name = form.name.trim();
    const difficultyLevel = Number(form.difficultyLevel) || 1;
    const targetValue =
      form.targetValue > 0 ? Number(form.targetValue) : undefined;
    const description = form.description.trim()
      ? form.description.trim()
      : undefined;
    if (variant) {
      // Update uses Record<string, unknown>; send null to clear optional fields.
      updateVariant.mutate({
        id: variant.id,
        body: {
          name,
          difficultyLevel,
          targetValue: targetValue ?? null,
          description: description ?? null,
        },
      });
    } else {
      // Create uses typed body with optional fields — use undefined to omit.
      addVariant.mutate({
        exerciseId,
        body: { name, difficultyLevel, targetValue, description },
      });
    }
    setVariantDialogOpen(false);
    setVariantContext(null);
  };

  const confirmDeleteVariant = () => {
    if (!deletingVariant) return;
    deleteVariant.mutate(deletingVariant.variant.id);
    setDeletingVariant(null);
  };

  /* ----- render ----- */
  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un exercice par nom…"
              className="pl-9"
              aria-label="Rechercher un exercice"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <Button
              onClick={() => useAppStore.getState().setView("templates")}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Templates
            </Button>
            <Button
              onClick={() => setCategoryDialogOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              Catégories
            </Button>
            <Button onClick={openCreateExercise} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un exercice
            </Button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const meta = getCatMeta(cat);
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors tabular-nums",
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
                style={
                  active
                    ? { backgroundColor: meta.color, color: "white" }
                    : undefined
                }
              >
                <span aria-hidden>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
          {activeCategories.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setActiveCategories(new Set())}
            >
              Effacer
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="max-h-[calc(100vh-220px)] pr-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Dumbbell className="mb-3 h-8 w-8 animate-pulse" />
            <p className="text-sm">Chargement…</p>
          </div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title={search || activeCategories.size > 0 ? "Aucun exercice ne correspond" : "Aucun exercice pour le moment"}
            description={
              search || activeCategories.size > 0
                ? "Essaie d'ajuster ta recherche ou tes filtres de catégorie."
                : "Ajoute ton premier exercice pour commencer à suivre tes progressions."
            }
            action={
              !search && activeCategories.size === 0 ? (
                <Button onClick={openCreateExercise} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter un exercice
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-8">
            {categories.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0) return null;
              const meta = getCatMeta(cat);
              return (
                <section key={cat} className="flex flex-col">
                  <SectionHeading
                    title={`${meta.emoji}  ${meta.label}`}
                    subtitle={`${items.length} exercice${items.length === 1 ? "" : "s"}`}
                  />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((ex) => (
                      <ExerciseCard
                        key={ex.id}
                        exercise={ex}
                        workouts={workoutsQ.data ?? []}
                        onViewDetail={() =>
                          useAppStore.getState().viewExerciseDetail(ex.id)
                        }
                        onEdit={() => openEditExercise(ex)}
                        onDelete={() => setDeletingExercise(ex)}
                        onAddVariant={() => openAddVariant(ex.id, ex.isStatic)}
                        onEditVariant={(v) => openEditVariant(ex.id, ex.isStatic, v)}
                        onDeleteVariant={(v) =>
                          setDeletingVariant({ exerciseId: ex.id, variant: v })
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Category manager dialog */}
      <CategoryManagerDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />

      {/* Exercise create/edit dialog */}
      <ExerciseFormDialog
        open={exerciseDialogOpen}
        onOpenChange={setExerciseDialogOpen}
        editing={editingExercise}
        categories={categories}
        onSubmit={submitExercise}
        pending={createExercise.isPending || updateExercise.isPending}
      />

      {/* Delete exercise confirmation */}
      <AlertDialog
        open={!!deletingExercise}
        onOpenChange={(o) => !o && setDeletingExercise(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingExercise && (
                <>
                  Cette action supprimera définitivement{" "}
                  <span className="font-semibold text-foreground">
                    {deletingExercise.name}
                  </span>{" "}
                  ainsi que toutes ses variantes. Les séances passées qui utilisent
                  cet exercice seront également supprimées (effet cascade). Cette
                  action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDeleteExercise}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Variant create/edit dialog */}
      <VariantFormDialog
        open={variantDialogOpen}
        onOpenChange={setVariantDialogOpen}
        context={variantContext}
        onSubmit={submitVariant}
        pending={addVariant.isPending || updateVariant.isPending}
      />

      {/* Delete variant confirmation */}
      <AlertDialog
        open={!!deletingVariant}
        onOpenChange={(o) => !o && setDeletingVariant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la variante ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingVariant && (
                <>
                  Retirer la progression{" "}
                  <span className="font-semibold text-foreground">
                    {deletingVariant.variant.name}
                  </span>{" "}
                  de l'arbre ? Les séries passées qui utilisent cette variante
                  perdront leur référence (mise à null), mais les entrées de séance
                  sont conservées.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDeleteVariant}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise card                                                      */
/* ------------------------------------------------------------------ */

function ExerciseCard({
  exercise,
  workouts,
  onViewDetail,
  onEdit,
  onDelete,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}: {
  exercise: ExerciseWithVariants;
  workouts: import("@/lib/types").WorkoutFull[];
  onViewDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddVariant: () => void;
  onEditVariant: (v: ExerciseVariant) => void;
  onDeleteVariant: (v: ExerciseVariant) => void;
}) {
  const getCatMeta = useCategoryMeta();
  const meta = getCatMeta(exercise.category as ExerciseCategory);
  const sortedVariants = React.useMemo(
    () =>
      [...exercise.variants].sort(
        (a, b) => (a.difficultyLevel ?? 1) - (b.difficultyLevel ?? 1),
      ),
    [exercise.variants],
  );
  const unit = metricUnit(exercise.isStatic);

  // Find the current variant (hardest variant used in the most recent workout)
  const currentVariantId = React.useMemo(() => {
    const sortedWorkouts = [...workouts]
      .filter((w) => w.entries.some((e) => e.exerciseId === exercise.id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sortedWorkouts.length === 0) return null;
    const latestEntry = sortedWorkouts[0].entries.find(
      (e) => e.exerciseId === exercise.id,
    );
    if (!latestEntry) return null;
    let hardest: string | null = null;
    let bestDiff = -1;
    for (const set of latestEntry.sets) {
      if (set.variant?.id && (set.variant.difficultyLevel ?? 0) > bestDiff) {
        hardest = set.variant.id;
        bestDiff = set.variant.difficultyLevel ?? 0;
      }
    }
    return hardest;
  }, [workouts, exercise.id]);

  return (
    <Card
      className="cursor-pointer overflow-hidden py-0 transition-shadow hover:shadow-md"
      style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}
      onClick={onViewDetail}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-foreground">
            {exercise.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {exercise.muscleGroup}
            {exercise.equipment ? ` · ${exercise.equipment}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className="border-transparent text-[10px]"
            style={{ backgroundColor: meta.color, color: "white" }}
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
          <Badge
            variant="outline"
            className="gap-1 text-[10px] font-medium text-muted-foreground"
          >
            {exercise.isStatic ? (
              <>
                <Clock className="h-3 w-3" />
                Maintien
              </>
            ) : (
              <>
                <Repeat className="h-3 w-3" />
                Reps
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Description */}
      {exercise.description && (
        <p className="mt-2 px-4 text-sm text-muted-foreground line-clamp-2">
          {exercise.description}
        </p>
      )}

      {/* Progression tree */}
      <CardContent className="mt-3 px-4 pb-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Progression
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {sortedVariants.length} marche{sortedVariants.length === 1 ? "" : "s"}
          </span>
        </div>

        {sortedVariants.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-center text-xs text-muted-foreground">
            Aucune variante pour le moment. Ajoute la première marche de progression.
          </div>
        ) : (
          <ol className="flex flex-col">
            {sortedVariants.map((v, idx) => {
              const isLast = idx === sortedVariants.length - 1;
              const isCurrent = v.id === currentVariantId;
              return (
                <li
                  key={v.id}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/40",
                    isCurrent && "bg-primary/5 ring-1 ring-primary/20",
                  )}
                >
                  {/* connector + rank circle */}
                  <div className="relative flex flex-col items-center">
                    {!isLast && (
                      <span
                        className="absolute top-1/2 h-[calc(100%+0.25rem)] w-px bg-border"
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                        isCurrent
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground",
                      )}
                    >
                      {idx + 1}
                    </span>
                  </div>

                  {/* body */}
                  <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {v.name}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          En cours
                        </span>
                      )}
                      <span
                        className="shrink-0 text-[11px] tracking-tight text-amber-500"
                        aria-label={`Difficulté ${v.difficultyLevel} sur 5`}
                      >
                        {difficultyStars(v.difficultyLevel)}
                      </span>
                    </div>
                    {v.description && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {v.description}
                      </p>
                    )}
                  </div>

                  {/* target + actions */}
                  <div className="flex items-center gap-1.5">
                    {v.targetValue ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                        <Target className="h-3 w-3" />
                        {v.targetValue}
                        <span className="opacity-70">{unit}</span>
                      </span>
                    ) : null}
                    <div className="flex items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onEditVariant(v); }}
                        aria-label="Modifier la variante"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDeleteVariant(v); }}
                        aria-label="Supprimer la variante"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          {sortedVariants.length} variante{sortedVariants.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onAddVariant(); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une variante
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Actions de l'exercice"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              {exercise.name !== "Combos" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise form dialog (create + edit)                               */
/* ------------------------------------------------------------------ */

function ExerciseFormDialog({
  open,
  onOpenChange,
  editing,
  categories,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ExerciseWithVariants | null;
  categories: ExerciseCategory[];
  onSubmit: (form: ExerciseFormState) => void;
  pending: boolean;
}) {
  const getCatMeta = useCategoryMeta();
  const [form, setForm] = React.useState<ExerciseFormState>(EMPTY_EXERCISE_FORM);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        category: (editing.category as ExerciseCategory) ?? "Push",
        tags: (editing as unknown as { tags: string[] }).tags ?? [],
        muscleGroup: editing.muscleGroup ?? "Corps complet",
        isStatic: editing.isStatic,
        description: editing.description ?? "",
        equipment: editing.equipment ?? "",
      });
    } else {
      setForm(EMPTY_EXERCISE_FORM);
    }
  }, [open, editing]);

  const update = <K extends keyof ExerciseFormState>(
    key: K,
    value: ExerciseFormState[K],
  ) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Modifier l'exercice" : "Ajouter un exercice"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Mets à jour les détails de l'exercice et ses réglages de progression."
              : "Crée un nouvel exercice suivi. Tu pourras ajouter des variantes ensuite."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-name">Nom</Label>
            <Input
              id="ex-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="ex. Planche, Tractions, Pistol Squat"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Catégorie</Label>
              <Select
                value={form.category}
                onValueChange={(v) => update("category", v as ExerciseCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => {
                    const meta = getCatMeta(cat);
                    return (
                      <SelectItem key={cat} value={cat}>
                        {meta.emoji} {meta.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ex-muscle">Groupe musculaire</Label>
              <Input
                id="ex-muscle"
                value={form.muscleGroup}
                onChange={(e) => update("muscleGroup", e.target.value)}
                placeholder="ex. Pectoraux, Dos, Corps complet"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
            <div className="min-w-0">
              <Label htmlFor="ex-static" className="cursor-pointer">
                Maintien isométrique
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Compter des secondes au lieu de reps.
              </p>
            </div>
            <Switch
              id="ex-static"
              checked={form.isStatic}
              onCheckedChange={(v) => update("isStatic", v)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-equipment">Équipement (optionnel)</Label>
            <Input
              id="ex-equipment"
              value={form.equipment}
              onChange={(e) => update("equipment", e.target.value)}
              placeholder="ex. Paralettes, Anneaux, Mur"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Catégories secondaires</Label>
            <div className="flex flex-wrap gap-1.5">
              {categories
                .filter((cat) => cat !== form.category)
                .map((cat) => {
                  const meta = getCatMeta(cat);
                  const selected = form.tags.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        update(
                          "tags",
                          selected
                            ? form.tags.filter((t) => t !== cat)
                            : [...form.tags, cat],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-foreground/40 bg-foreground/10 text-foreground"
                          : "border-border/60 text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      {meta.emoji} {meta.label}
                    </button>
                  );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
              Catégories additionnelles pour retrouver cet exercice dans les filtres.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-desc">Description (optionnelle)</Label>
            <Textarea
              id="ex-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Notes brèves sur l'exécution, le setup ou l'objectif."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Créer l'exercice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Variant form dialog (create + edit)                                */
/* ------------------------------------------------------------------ */

function VariantFormDialog({
  open,
  onOpenChange,
  context,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  context: {
    exerciseId: string;
    isStatic: boolean;
    variant: ExerciseVariant | null;
  } | null;
  onSubmit: (form: VariantFormState) => void;
  pending: boolean;
}) {
  const [form, setForm] = React.useState<VariantFormState>(EMPTY_VARIANT_FORM);

  React.useEffect(() => {
    if (!open || !context) return;
    if (context.variant) {
      setForm({
        name: context.variant.name,
        difficultyLevel: context.variant.difficultyLevel ?? 1,
        targetValue: context.variant.targetValue ?? 0,
        description: context.variant.description ?? "",
      });
    } else {
      setForm(EMPTY_VARIANT_FORM);
    }
  }, [open, context]);

  const update = <K extends keyof VariantFormState>(
    key: K,
    value: VariantFormState[K],
  ) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !context) return;
    onSubmit(form);
  };

  const unit = context ? metricUnit(context.isStatic) : "reps";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {context?.variant ? "Modifier la variante" : "Ajouter une variante de progression"}
          </DialogTitle>
          <DialogDescription>
            {context?.variant
              ? "Mets à jour cette marche de l'arbre de progression."
              : "Ajoute une nouvelle marche à la progression (ex. Tuck → Advanced Tuck → Full)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="var-name">Nom de la variante</Label>
            <Input
              id="var-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="ex. Tuck, Advanced Tuck, Straddle, Full"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="var-level">Rang de difficulté</Label>
              <span className="text-[11px] text-muted-foreground leading-tight">(1 = le plus facile)</span>
              <Input
                id="var-level"
                type="number"
                placeholder="1"
                value={form.difficultyLevel || ""}
                onChange={(e) =>
                  update(
                    "difficultyLevel",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                className="tabular-nums mt-1"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="var-target">Objectif</Label>
              <span className="text-[11px] text-muted-foreground leading-tight">({unit})</span>
              <Input
                id="var-target"
                type="number"
                value={form.targetValue || ""}
                onChange={(e) =>
                  update(
                    "targetValue",
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                placeholder="0 = aucun"
                className="tabular-nums mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="tabular-nums">
              Aperçu des étoiles de difficulté :{" "}
              <span className="text-amber-500">
                {difficultyStars(Math.min(Math.max(form.difficultyLevel, 0), 5))}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="var-desc">Description (optionnelle)</Label>
            <Textarea
              id="var-desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Indices d'exécution, prérequis ou notes de coaching."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {pending
                ? "Enregistrement…"
                : context?.variant
                  ? "Enregistrer"
                  : "Ajouter la variante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
