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

/** Format raw mmss digits into mm:ss for display. */
function fmt(raw: string): string {
  const p = raw.padStart(3, "0");
  return `${p.slice(0, -2).padStart(2, "0")}:${p.slice(-2)}`;
}

/** Parse raw mmss digits → seconds (last 2 = ss, rest = mm). */
function parse(raw: string): number {
  const ss = parseInt(raw.slice(-2), 10);
  const mm = raw.length > 2 ? parseInt(raw.slice(0, -2), 10) : 0;
  return mm * 60 + (isNaN(ss) ? 0 : ss);
}

export function CustomRestTrigger() {
  const [open, setOpen] = React.useState(false);
  const [raw, setRaw] = React.useState("0130");
  const ref = React.useRef<HTMLInputElement>(null);

  const sessionActive = useDraftStore((s) => s.sessionStartedAt != null);
  const lastCustom = useTimerStore((s) => s.lastCustomRestSec);
  const start = useTimerStore((s) => s.start);
  const setLastCustomRestSec = useTimerStore((s) => s.setLastCustomRestSec);

  // Pre-fill with last custom value when dialog opens
  React.useEffect(() => {
    if (open) {
      const m = Math.floor(lastCustom / 60);
      const s = lastCustom % 60;
      setRaw(`${String(m).padStart(2, "0")}${String(s).padStart(2, "0")}`);
    }
  }, [open, lastCustom]);

  // Keep cursor at the end after every render
  React.useEffect(() => {
    if (open && ref.current) {
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [open, raw]);

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(-4);
    setRaw(digits.padStart(4, "0"));
  }

  function handleSubmit() {
    const sec = parse(raw);
    if (sec <= 0) return;
    setLastCustomRestSec(sec);
    start(sec);
    setOpen(false);
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
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <Input
                ref={ref}
                value={fmt(raw)}
                onChange={(e) => handleChange(e.target.value)}
                className="h-16 w-40 text-center text-3xl tabular-nums tracking-widest"
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {parse(raw) >= 60
                ? `${Math.floor(parse(raw) / 60)} min ${parse(raw) % 60 || ""}`
                : `${parse(raw)} s`}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} className="w-full">
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
