"use client";

import * as React from "react";

export const ACCENT_THEMES = [
  { id: "default", label: "Défaut", color: "#6b7280" },
  { id: "emerald", label: "Emeraude", color: "#10b981" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
  { id: "amber", label: "Ambre", color: "#f59e0b" },
  { id: "rose", label: "Rose", color: "#f43f5e" },
  { id: "sky", label: "Ciel", color: "#0ea5e9" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "fuchsia", label: "Fuchsia", color: "#d946ef" },
  { id: "cyan", label: "Cyan", color: "#06b6d4" },
  { id: "lime", label: "Lime", color: "#84cc16" },
] as const;

type AccentId = (typeof ACCENT_THEMES)[number]["id"];

const AccentContext = React.createContext<{
  accent: AccentId;
  setAccent: (id: AccentId) => void;
}>({
  accent: "default",
  setAccent: () => {},
});

const STORAGE_KEY = "calitrack-accent";

function getStoredAccent(): AccentId {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ACCENT_THEMES.some((t) => t.id === stored)) return stored as AccentId;
  return "default";
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = React.useState<AccentId>("default");

  React.useEffect(() => {
    const stored = getStoredAccent();
    setAccentState(stored);
  }, []);

  const setAccent = React.useCallback((id: AccentId) => {
    setAccentState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  React.useEffect(() => {
    const html = document.documentElement;
    ACCENT_THEMES.forEach((t) => html.classList.toggle(`accent-${t.id}`, t.id === accent && t.id !== "default"));
  }, [accent]);

  return React.createElement(AccentContext.Provider, { value: { accent, setAccent } }, children);
}

export function useAccent() {
  return React.useContext(AccentContext);
}