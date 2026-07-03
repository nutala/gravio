"use client";

import * as React from "react";

interface WorkoutShortcuts {
  onValidateCurrentSet?: () => void;
  onAddSet?: () => void;
  onStartRest?: () => void;
  onOpenRestPresets?: () => void;
  enabled?: boolean;
}

export function useWorkoutShortcuts({
  onValidateCurrentSet,
  onAddSet,
  onStartRest,
  onOpenRestPresets,
  enabled = true,
}: WorkoutShortcuts) {
  const [showCheatsheet, setShowCheatsheet] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;

    function isInputFocused() {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "?") {
        setShowCheatsheet((p) => !p);
        return;
      }

      if (isInputFocused()) {
        if (e.key === "Enter" && onValidateCurrentSet) {
          e.preventDefault();
          onValidateCurrentSet();
        }
        return;
      }

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          onValidateCurrentSet?.();
          break;
        case "r":
        case "R":
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            onOpenRestPresets?.();
          } else {
            onStartRest?.();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onValidateCurrentSet, onAddSet, onStartRest, onOpenRestPresets]);

  return { showCheatsheet, setShowCheatsheet };
}
