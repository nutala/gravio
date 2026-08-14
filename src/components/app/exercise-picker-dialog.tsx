"use client";

import * as React from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useExercises, useCategoryMeta } from "@/hooks/use-data";
import type { ExerciseWithVariants, ExerciseCategory } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: ExerciseWithVariants) => void;
  title?: string;
  description?: string;
  excludeIds?: string[];
}

export function ExercisePickerDialog({
  open,
  onOpenChange,
  onPick,
  title = "Ajouter un exercice",
  description = "Recherche et choisis un exercice.",
  excludeIds,
}: Props) {
  const { data: exercises } = useExercises();
  const getCatMeta = useCategoryMeta();

  const grouped = React.useMemo(() => {
    if (!exercises) return [];
    const map = new Map<string, ExerciseWithVariants[]>();
    for (const ex of exercises) {
      const arr = map.get(ex.category) ?? [];
      arr.push(ex);
      map.set(ex.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [exercises]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="sm:max-w-md"
    >
      <Command>
        <CommandInput placeholder="Rechercher un exercice..." />
        <CommandList>
          <CommandEmpty>Aucun exercice trouvé.</CommandEmpty>
          {grouped
            .map(([cat, list]) => [cat, excludeIds ? list.filter((ex) => !excludeIds.includes(ex.id)) : list] as const)
            .filter(([, list]) => list.length > 0)
            .map(([cat, list]) => {
            const meta = getCatMeta(cat);
            return (
              <CommandGroup
                key={cat}
                heading={`${meta.emoji} ${meta.label}`}
              >
                {list.map((ex) => (
                  <CommandItem
                    key={ex.id}
                    value={`${ex.name} ${cat} ${ex.muscleGroup} ${(ex as unknown as { tags: string[] }).tags?.join(" ") ?? ""}`}
                    onSelect={() => onPick(ex)}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {meta.emoji}
                    </span>
                    <span className="flex-1 truncate">{ex.name}</span>
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
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
