"use client";

import * as React from "react";
import { Timer } from "lucide-react";

import { useTimerStore } from "@/lib/timer-store";
import { useDraftStore } from "@/lib/draft-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function CustomRestTrigger() {
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState(1);
  const [seconds, setSeconds] = React.useState(30);

  const sessionActive = useDraftStore((s) => s.sessionStartedAt != null);
  const lastCustom = useTimerStore((s) => s.lastCustomRestSec);
  const start = useTimerStore((s) => s.start);
  const setLastCustomRestSec = useTimerStore((s) => s.setLastCustomRestSec);

  React.useEffect(() => {
    if (open) {
      setMinutes(Math.floor(lastCustom / 60));
      setSeconds(lastCustom % 60);
    }
  }, [open, lastCustom]);

  function handleSubmit() {
    const sec = minutes * 60 + seconds;
    if (sec <= 0) return;
    setLastCustomRestSec(sec);
    start(sec);
    setOpen(false);
  }

  function clampMinutes(v: string): number {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    if (isNaN(n)) return 0;
    return Math.min(n, 99);
  }

  function clampSeconds(v: string): number {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    if (isNaN(n)) return 0;
    return Math.min(n, 59);
  }

  if (!sessionActive) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="relative"
        aria-label="Lancer un repos personnalisé"
      >
        <Timer className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-64">
          <DialogHeader>
            <DialogTitle>Repos</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-1 py-4">
            <Input
              value={String(minutes).padStart(2, "0")}
              onChange={(e) => setMinutes(clampMinutes(e.target.value))}
              className="h-14 w-16 text-center text-2xl tabular-nums"
              inputMode="numeric"
            />
            <span className="text-2xl text-muted-foreground">:</span>
            <Input
              value={String(seconds).padStart(2, "0")}
              onChange={(e) => setSeconds(clampSeconds(e.target.value))}
              className="h-14 w-16 text-center text-2xl tabular-nums"
              inputMode="numeric"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} className="w-full">
              Lancer {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
