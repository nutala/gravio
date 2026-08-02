"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  FileText,
  Play,
  Pencil,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";

import { useTemplates, useDeleteTemplate } from "@/hooks/use-data";
import { useAppStore } from "@/lib/store";
import { useDraftStore } from "@/lib/draft-store";
import { useExercises } from "@/hooks/use-data";
import type { ExerciseWithVariants } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TemplatesView() {
  const { data: templates, isLoading } = useTemplates();
  const { data: exercises } = useExercises();
  const deleteTemplate = useDeleteTemplate();
  const { viewTemplateEditor, setView } = useAppStore();
  const draft = useDraftStore();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  function handleUseTemplate(tpl: NonNullable<typeof templates>[number]) {
    const exMap = new Map<string, ExerciseWithVariants>();
    for (const ex of exercises ?? []) exMap.set(ex.id, ex);
    draft.loadFromTemplate(tpl, exMap);
    setView("new-workout");
    toast.success(`Template « ${tpl.name} » chargé`);
  }

  async function executeDelete() {
    if (!deleteId) return;
    await deleteTemplate.mutateAsync(deleteId);
    setDeleteId(null);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Prépare tes séances à l&apos;avance
          </p>
        </div>
        <Button onClick={() => viewTemplateEditor()}>
          <Plus className="h-4 w-4" />
          Nouveau template
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!templates || templates.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Aucun template</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crée ton premier template pour gagner du temps quand tu lances une séance.
          </p>
          <div className="mt-4">
            <Button onClick={() => viewTemplateEditor()}>
              <Plus className="h-4 w-4" />
              Nouveau template
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {!isLoading && templates && templates.length > 0 && (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.04 }}
        >
          {templates.map((tpl, idx) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
            >
              <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold">{tpl.name}</CardTitle>
                      {tpl.notes && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {tpl.notes}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleUseTemplate(tpl)}>
                          <Play className="h-3.5 w-3.5 mr-2" />
                          Utiliser
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => viewTemplateEditor(tpl.id)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(tpl.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {tpl.entries.slice(0, 6).map((e) => (
                      <Badge key={e.id} variant="secondary" className="text-[10px]">
                        {e.exercise.name}
                      </Badge>
                    ))}
                    {tpl.entries.length > 6 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{tpl.entries.length - 6}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le template sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}