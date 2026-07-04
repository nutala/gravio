"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Share2, BarChart3, X, Dumbbell, Timer, Activity, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSettingsStore } from "@/lib/settings-store";
import { fmtWeight } from "@/lib/calc";

export interface WorkoutSummary {
  title: string;
  date: string;
  durationMin: number;
  exertion: number;
  bodyweight: number | "";
  entryCount: number;
  totalSets: number;
  totalVolume: number;
  prs: { exerciseName: string; variantName: string | null; value: string; unit: string }[];
}

interface WorkoutSummaryModalProps {
  open: boolean;
  summary: WorkoutSummary | null;
  onClose: () => void;
  onViewProgress: () => void;
}

export function WorkoutSummaryModal({ open, summary, onClose, onViewProgress }: WorkoutSummaryModalProps) {
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const confettiRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open && summary && summary.prs.length > 0) {
      triggerConfetti();
    }
  }, [open, summary]);

  function triggerConfetti() {
    const el = confettiRef.current;
    if (!el) return;
    for (let i = 0; i < 40; i++) {
      const particle = document.createElement("div");
      particle.className = "absolute h-2 w-2 rounded-full pointer-events-none";
      const colors = ["#10b981", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#f97316"];
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = "-4px";
      particle.style.animation = `confetti-fall ${0.8 + Math.random() * 0.6}s ease-out forwards`;
      particle.style.animationDelay = `${Math.random() * 0.3}s`;
      particle.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.appendChild(particle);
      setTimeout(() => particle.remove(), 2000);
    }
  }

  async function handleShare() {
    if (!summary) return;
    const text = [
      `💪 Séance : ${summary.title || "Sans titre"}`,
      `📅 ${summary.date}`,
      `⏱ ${summary.durationMin} min`,
      `🏋️ ${summary.totalSets} séries · ${summary.totalVolume} vol`,
      summary.prs.length > 0 ? `🏆 Records : ${summary.prs.map((p) => `${p.exerciseName} ${p.value}${p.unit}`).join(", ")}` : "",
      `\nGravio — suivi calisthénie`,
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Gravio — Résumé séance", text });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <AnimatePresence>
      {open && summary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="relative z-10 mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl"
          >
            {/* Confetti container */}
            <div ref={confettiRef} className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" />

            {summary.prs.length > 0 && (
              <style>{`
                @keyframes confetti-fall {
                  0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
                  100% { opacity: 0; transform: translateY(400px) rotate(720deg) scale(0.3); }
                }
              `}</style>
            )}

            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Trophy className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Séance enregistrée 🎉
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.title || "Sans titre"} · {summary.date}
              </p>
            </div>

            {/* KPIs */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryKPI icon={Timer} label="Durée" value={`${summary.durationMin} min`} />
              <SummaryKPI icon={Dumbbell} label="Exercices" value={`${summary.entryCount}`} />
              <SummaryKPI icon={Activity} label="Séries" value={`${summary.totalSets}`} />
              <SummaryKPI icon={BarChart3} label="Volume" value={`${summary.totalVolume}`} />
              {summary.exertion > 0 && (
                <SummaryKPI icon={Gauge} label="RPE" value={`${summary.exertion}/10`} />
              )}
              {summary.bodyweight !== "" && (
                <SummaryKPI icon={Trophy} label="Poids" value={fmtWeight(Number(summary.bodyweight), weightUnit)} />
              )}
            </div>

            {/* PRs */}
            {summary.prs.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Trophy className="h-4 w-4" />
                  <span className="text-sm font-semibold">Records personnels 🏆</span>
                </div>
                <div className="space-y-1.5">
                  {summary.prs.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {pr.exerciseName}
                        {pr.variantName && (
                          <span className="text-muted-foreground"> · {pr.variantName}</span>
                        )}
                      </span>
                      <span className="font-bold tabular-nums text-emerald-500">
                        {pr.value} <span className="text-xs text-muted-foreground">{pr.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  onClose();
                  onViewProgress();
                }}
              >
                <BarChart3 className="h-4 w-4" />
                Voir progression
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                Fermer
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SummaryKPI({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg font-bold tabular-nums text-foreground">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
