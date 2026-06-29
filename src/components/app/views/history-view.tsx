"use client";

import * as React from "react";
import {
  useWorkouts,
  useDeleteWorkout,
  useUpdateWorkout,
  useCategoryMeta,
} from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import {
  type ExerciseCategory,
  type WorkoutFull,
  type WorkoutEntryFull,
} from "@/lib/types";
import {
  fmtCompact,
  fmtDate,
  metricUnit,
  relativeFromNow,
  setMetric,
  variantLabel,
  supersetLabel,
  supersetColor,
} from "@/lib/calc";
import { EmptyState } from "@/components/app/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Gauge,
  History,
  Layers,
  Link2,
  MoreVertical,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Timer,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Perceived-exertion color (1-3 emerald, 4-7 amber, 8-10 red). */
function exertionColor(pe: number): string {
  if (pe <= 3) return "text-emerald-500";
  if (pe <= 7) return "text-amber-500";
  return "text-red-500";
}

/** Total number of sets across a workout. */
function workoutSetsCount(w: WorkoutFull): number {
  return w.entries.reduce((acc, e) => acc + e.sets.length, 0);
}

/** Total volume (sum of metric across sets) for a workout. */
function workoutVolume(w: WorkoutFull): number {
  return w.entries.reduce(
    (acc, e) => acc + e.sets.reduce((s, set) => s + setMetric(set), 0),
    0,
  );
}

/** Case-insensitive search against workout title or any exercise name. */
function matchesSearch(w: WorkoutFull, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (w.title?.toLowerCase().includes(needle)) return true;
  return w.entries.some((e) =>
    e.exercise.name.toLowerCase().includes(needle),
  );
}

/** Safely coerce the (possibly stringified) workout date into a real Date. */
function toDate(d: string | Date): Date {
  return d instanceof Date ? d : parseISO(d);
}

/** Group workouts into consecutive month buckets (already sorted). */
function groupByMonth(workouts: WorkoutFull[]): {
  key: string;
  label: string;
  workouts: WorkoutFull[];
}[] {
  const out: {
    key: string;
    label: string;
    workouts: WorkoutFull[];
  }[] = [];
  let currentKey: string | null = null;
  for (const w of workouts) {
    const d = toDate(w.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== currentKey) {
      out.push({ key, label: format(d, "MMMM yyyy", { locale: fr }), workouts: [w] });
      currentKey = key;
    } else {
      out[out.length - 1].workouts.push(w);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function HistoryView() {
  const { data, isLoading, isError } = useWorkouts();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(undefined);

  const workouts = React.useMemo(() => {
    if (!data) return [];
    const filtered = data.filter((w) => matchesSearch(w, search.trim()));
    const sorted = [...filtered].sort((a, b) => {
      const ta = toDate(a.date).getTime();
      const tb = toDate(b.date).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });
    return sorted;
  }, [data, search, sort]);

  const groups = React.useMemo(() => groupByMonth(workouts), [workouts]);

  const workoutDays = React.useMemo(() => {
    const days = new Set<string>();
    for (const w of workouts) {
      days.add(format(toDate(w.date), "yyyy-MM-dd"));
    }
    return days;
  }, [workouts]);

  const dayWorkouts = React.useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return workouts.filter((w) => format(toDate(w.date), "yyyy-MM-dd") === key);
  }, [selectedDay, workouts]);

  /* ---- Loading / error / empty states ---- */
  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Chargement de l'historique…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-16 text-center text-sm text-destructive">
        Échec du chargement des séances.
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="py-6">
        <EmptyState
          icon={History}
          title="Aucune séance pour le moment"
          description="Enregistre ta première session pour commencer à suivre ta progression."
          action={
            <Button
              onClick={() => useAppStore.getState().setView("new-workout")}
            >
              <PlusCircle className="h-4 w-4" />
              Nouvelle séance
            </Button>
          }
        />
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        sort={sort}
        onSort={setSort}
        total={data.length}
        showing={workouts.length}
        showCalendar={showCalendar}
        onToggleCalendar={() => {
          setShowCalendar((p) => !p);
          setSelectedDay(undefined);
        }}
      />

      {showCalendar ? (
        <div className="space-y-4">
          <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDay}
                onSelect={setSelectedDay}
                locale={fr}
                modifiers={{
                  hasWorkout: (date) =>
                    workoutDays.has(format(date, "yyyy-MM-dd")),
                }}
                modifiersClassNames={{
                  hasWorkout: "has-workout-day",
                }}
                className="has-workout-calendar rounded-lg border border-border/60"
              />
              <style>{`
                .has-workout-day button {
                  position: relative;
                  font-weight: 600;
                }
                .has-workout-day button::after {
                  content: '';
                  position: absolute;
                  bottom: 0px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 4px;
                  height: 4px;
                  border-radius: 9999px;
                  background: hsl(var(--primary));
                }
                .has-workout-day[data-selected-single=true] button::after,
                [data-selected=true] .has-workout-day button::after {
                  background: hsl(var(--primary-foreground));
                }
              `}</style>
          </div>

          {selectedDay && dayWorkouts.length > 0 ? (
            <div className="space-y-3">
              {dayWorkouts.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  expanded={expandedId === w.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === w.id ? null : w.id))
                  }
                />
              ))}
            </div>
          ) : selectedDay ? (
            <EmptyState
              icon={Search}
              title="Aucune séance"
              description={format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })}
            />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Sélectionne un jour pour voir les séances.
            </div>
          )}
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Aucun résultat"
          description="Essaie un autre titre ou nom d'exercice."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="sticky top-16 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {g.label}
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {g.workouts.length} séance
                    {g.workouts.length > 1 ? "s" : ""}
                  </span>
                </div>
                <Separator className="mt-1.5" />
              </div>

              {g.workouts.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  expanded={expandedId === w.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === w.id ? null : w.id))
                  }
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function Toolbar({
  search,
  onSearch,
  sort,
  onSort,
  total,
  showing,
  showCalendar,
  onToggleCalendar,
}: {
  search: string;
  onSearch: (v: string) => void;
  sort: "newest" | "oldest";
  onSort: (v: "newest" | "oldest") => void;
  total: number;
  showing: number;
  showCalendar: boolean;
  onToggleCalendar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher un titre ou un exercice…"
          className="pl-9"
          aria-label="Rechercher une séance"
        />
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <Button
          variant={showCalendar ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={onToggleCalendar}
          aria-label="Vue calendrier"
        >
          <CalendarDays className="h-4 w-4" />
          {showCalendar ? "Liste" : "Calendrier"}
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {showing}/{total} séances
        </span>
        <Select
          value={sort}
          onValueChange={(v) => onSort(v as "newest" | "oldest")}
        >
          <SelectTrigger size="sm" className="w-[150px]" aria-label="Ordre de tri">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Plus récent d'abord</SelectItem>
            <SelectItem value="oldest">Plus ancien d'abord</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workout card                                                        */
/* ------------------------------------------------------------------ */

function WorkoutCard({
  workout,
  expanded,
  onToggle,
}: {
  workout: WorkoutFull;
  expanded: boolean;
  onToggle: () => void;
}) {
  const date = toDate(workout.date);
  const totalSets = workoutSetsCount(workout);
  const totalVolume = workoutVolume(workout);
  const entryCount = workout.entries.length;
  const pe = workout.perceivedExertion ?? 0;
  const hasNotes = !!workout.notes?.trim();

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-stretch">
        {/* Clickable summary */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
        >
          {/* Date block */}
          <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-muted/50 py-1.5 text-center">
            <span className="text-xl font-bold leading-none tabular-nums text-foreground">
              {format(date, "dd")}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {format(date, "EEE", { locale: fr })}
            </span>
          </div>

          {/* Title + chips */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {workout.title?.trim() || "Séance sans titre"}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline">
                · {relativeFromNow(workout.date)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {workout.durationMin != null && (
                <Chip icon={Timer} label={`${workout.durationMin}m`} />
              )}
              {pe > 0 && (
                <Chip
                  icon={Gauge}
                  label={`RPE ${pe}`}
                  className={exertionColor(pe)}
                />
              )}
              <Chip icon={Dumbbell} label={`${entryCount}`} />
              <Chip icon={Layers} label={`${totalSets}`} />
              <Chip icon={Activity} label={fmtCompact(totalVolume)} />
              {hasNotes && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  notes
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Right-side actions (do not toggle on click) */}
        <div className="flex shrink-0 items-center gap-0.5 p-3 pr-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onToggle}
            aria-label={expanded ? "Replier les détails" : "Déplier les détails"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <OverflowMenu workout={workout} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
                <span>{fmtDate(workout.date, "EEEE d MMMM yyyy")}</span>
                {workout.bodyweightKg != null && (
                  <>
                    <span>·</span>
                    <span>BW {workout.bodyweightKg} kg</span>
                  </>
                )}
              </div>

              {hasNotes && (
                <div className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                  “{workout.notes!.trim()}”
                </div>
              )}

              {workout.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune entrée.</p>
              ) : (
                <div className="space-y-2">
                  {workout.entries.map((entry) => (
                    <EntryDetail key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Small chip                                                          */
/* ------------------------------------------------------------------ */

function Chip({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow menu (Edit / Delete)                                       */
/* ------------------------------------------------------------------ */

function OverflowMenu({ workout }: { workout: WorkoutFull }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const repeatWorkout = useAppStore((s) => s.repeatWorkout);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Actions de la séance"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => repeatWorkout(workout)}>
            <RefreshCw className="h-4 w-4" />
            Refaire la séance
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDialog
        workout={workout}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteDialog
        workoutId={workout.id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Expanded entry detail                                               */
/* ------------------------------------------------------------------ */

function EntryDetail({ entry }: { entry: WorkoutEntryFull }) {
  const getCatMeta = useCategoryMeta();
  const cat = (entry.exercise.category as ExerciseCategory) || "Push";
  const meta = getCatMeta(cat);
  const isStatic = entry.exercise.isStatic;
  const unit = metricUnit(isStatic);
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
            title="Fait partie d'un superset"
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
                  <td className="truncate py-1.5 pr-2 text-muted-foreground">
                    {s.setNumber}
                  </td>
                  <td className="truncate py-1.5 pr-2 font-medium text-foreground">
                    {s.variant ? variantLabel(s.variant) : "—"}
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
        <span>{totalSets} séries</span>
        <span aria-hidden>·</span>
        <span>{fmtCompact(totalVol)} vol</span>
        <span aria-hidden>·</span>
        <span>
          meilleure {best} {unit}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit dialog                                                         */
/* ------------------------------------------------------------------ */

function EditDialog({
  workout,
  open,
  onOpenChange,
}: {
  workout: WorkoutFull;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useUpdateWorkout();
  const [title, setTitle] = React.useState("");
  const [dateStr, setDateStr] = React.useState("");
  const [durationMin, setDurationMin] = React.useState("");
  const [pe, setPe] = React.useState(5);
  const [bodyweightKg, setBodyweightKg] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Reset form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setTitle(workout.title ?? "");
    setDateStr(format(toDate(workout.date), "yyyy-MM-dd"));
    setDurationMin(
      workout.durationMin != null ? String(workout.durationMin) : "",
    );
    setPe(workout.perceivedExertion ?? 5);
    setBodyweightKg(
      workout.bodyweightKg != null ? String(workout.bodyweightKg) : "",
    );
    setNotes(workout.notes ?? "");
  }, [open, workout]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      title: title.trim() || null,
      date: dateStr ? new Date(`${dateStr}T00:00:00`).toISOString() : undefined,
      durationMin: durationMin === "" ? null : Number(durationMin),
      perceivedExertion: pe,
      bodyweightKg: bodyweightKg === "" ? null : Number(bodyweightKg),
      notes: notes.trim() || null,
    };
    update.mutate(
      { id: workout.id, body },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la séance</DialogTitle>
          <DialogDescription>
            Mets à jour les métadonnées de la séance. Les séries et entrées ne sont pas modifiables ici.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hw-title">Titre</Label>
            <Input
              id="hw-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Séance sans titre"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="hw-date">Date</Label>
              <Input
                id="hw-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-duration">Durée (min)</Label>
              <Input
                id="hw-duration"
                type="number"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="—"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Effort perçu (RPE)</Label>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  exertionColor(pe),
                )}
              >
                {pe}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[pe]}
              onValueChange={(v) => setPe(v[0] ?? 5)}
              aria-label="Effort perçu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hw-bw">Poids du corps (kg)</Label>
            <Input
              id="hw-bw"
              type="number"
              step="0.1"
              min={0}
              value={bodyweightKg}
              onChange={(e) => setBodyweightKg(e.target.value)}
              placeholder="—"
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hw-notes">Notes</Label>
            <Textarea
              id="hw-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Comment était la séance ?"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete dialog                                                       */
/* ------------------------------------------------------------------ */

function DeleteDialog({
  workoutId,
  open,
  onOpenChange,
}: {
  workoutId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const del = useDeleteWorkout();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
          <AlertDialogDescription>
            Action irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }))}
            disabled={del.isPending}
            onClick={() =>
              del.mutate(workoutId, {
                onSuccess: () => onOpenChange(false),
              })
            }
          >
            {del.isPending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
