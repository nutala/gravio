"use client";

import * as React from "react";
import { installMockApi, FIXTURE_EXERCISES } from "@/app/dev/fixtures";
import { notFound } from "next/navigation";
import { ActiveWorkoutView } from "@/components/app/views/active-workout-view";
import { AppShell } from "@/components/app/app-shell";
import { useAppStore } from "@/lib/store";
import { useDraftStore } from "@/lib/draft-store";

installMockApi();

export default function DevWorkoutPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const entries = useDraftStore((s) => s.entries);
  const seeded = React.useRef(false);

  React.useEffect(() => {
    useAppStore.getState().setView("new-workout");
    if (seeded.current) return;
    if (useDraftStore.getState().entries.length > 0) return;
    seeded.current = true;
    const addEntry = useDraftStore.getState().addEntry;
    addEntry(FIXTURE_EXERCISES[0]); // Pompes (reps)
    addEntry(FIXTURE_EXERCISES[2]); // Planche (hold)
    useDraftStore.getState().setMeta("title", "Push & planche");
  }, []);

  return (
    <AppShell>
      <ActiveWorkoutView />
    </AppShell>
  );
}
