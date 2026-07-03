"use client";

import * as React from "react";
import { ArrowLeft, Volume2, Palette, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSettingsStore, type SoundProfile, type AccentTheme, type WeightUnit } from "@/lib/settings-store";
import { ACCENT_THEMES } from "@/components/providers/accent-provider";
import { useAppStore } from "@/lib/store";
import { playChime, playFail, playBeep } from "@/lib/sound";
import { cn } from "@/lib/utils";

const profiles: { id: SoundProfile; label: string; desc: string }[] = [
  { id: 1, label: "Classique", desc: "Sons par défaut — bipes carrés pour le repos, doubles notes pour la validation" },
  { id: 2, label: "Douceur", desc: "Sons doux en triangle — plus agréables, moins agressifs" },
  { id: 3, label: "Énergique", desc: "Sons aigus et percutants — pour rester motivé" },
  { id: 4, label: "Boxe", desc: "Cloche de ring pour la fin du repos, arpège pour la validation, grondement pour l'échec" },
];

export function SettingsView() {
  const soundProfile = useSettingsStore((s) => s.soundProfile);
  const setSoundProfile = useSettingsStore((s) => s.setSoundProfile);
  const accentTheme = useSettingsStore((s) => s.accentTheme);
  const setAccentTheme = useSettingsStore((s) => s.setAccentTheme);
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);
  const setView = useAppStore((s) => s.setView);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setView("profile")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Personnalise ton expérience</p>
        </div>
      </div>

      {/* Accent color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Couleur d'accent</CardTitle>
          </div>
          <CardDescription>
            Change la couleur principale de l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3 sm:flex sm:flex-wrap">
            {ACCENT_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAccentTheme(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all sm:p-3",
                  accentTheme === t.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-muted-foreground/40",
                )}
                title={t.label}
              >
                <span
                  className="h-8 w-8 rounded-full sm:h-10 sm:w-10"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weight unit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Weight className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Unités de poids</CardTitle>
          </div>
          <CardDescription>
            Choisis l'unité d'affichage pour les poids (corps, haltères, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={weightUnit}
            onValueChange={(v) => setWeightUnit(v as WeightUnit)}
            className="flex gap-4"
          >
            <Label
              htmlFor="unit-kg"
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                weightUnit === "kg"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <RadioGroupItem value="kg" id="unit-kg" className="sr-only" />
              Kilogrammes (kg)
            </Label>
            <Label
              htmlFor="unit-lb"
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                weightUnit === "lb"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <RadioGroupItem value="lb" id="unit-lb" className="sr-only" />
              Livres (lb)
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Sound profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Profil sonore</CardTitle>
          </div>
          <CardDescription>
            Choisis un profil pour les sons de validation, d'échec et de fin de repos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                soundProfile === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="soundProfile"
                value={p.id}
                checked={soundProfile === p.id}
                onChange={() => setSoundProfile(p.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playChime(p.id);
                  }}
                  className="inline-flex h-7 items-center rounded-md border border-border/60 bg-background px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  title="Prévisualiser le son de validation"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playFail(p.id);
                  }}
                  className="inline-flex h-7 items-center rounded-md border border-border/60 bg-background px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  title="Prévisualiser le son d'échec"
                >
                  ✗
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playBeep(p.id);
                  }}
                  className="inline-flex h-7 items-center rounded-md border border-border/60 bg-background px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  title="Prévisualiser le son de fin de repos"
                >
                  ♪
                </button>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
