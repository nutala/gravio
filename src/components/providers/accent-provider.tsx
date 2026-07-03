"use client";

import * as React from "react";
import { useSettingsStore, type AccentTheme } from "@/lib/settings-store";

export const ACCENT_THEMES = [
  { id: "default" as AccentTheme, label: "Défaut", color: "#6b7280" },
  { id: "emerald" as AccentTheme, label: "Émeraude", color: "#10b981" },
  { id: "violet" as AccentTheme, label: "Violet", color: "#8b5cf6" },
  { id: "amber" as AccentTheme, label: "Ambre", color: "#f59e0b" },
  { id: "rose" as AccentTheme, label: "Rose", color: "#f43f5e" },
  { id: "sky" as AccentTheme, label: "Ciel", color: "#0ea5e9" },
  { id: "orange" as AccentTheme, label: "Orange", color: "#f97316" },
  { id: "fuchsia" as AccentTheme, label: "Fuchsia", color: "#d946ef" },
  { id: "cyan" as AccentTheme, label: "Cyan", color: "#06b6d4" },
  { id: "lime" as AccentTheme, label: "Lime", color: "#84cc16" },
] as const;

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const accentTheme = useSettingsStore((s) => s.accentTheme);

  React.useEffect(() => {
    const html = document.documentElement;
    ACCENT_THEMES.forEach((t) =>
      html.classList.toggle(`accent-${t.id}`, t.id === accentTheme && t.id !== "default"),
    );
  }, [accentTheme]);

  return <>{children}</>;
}
