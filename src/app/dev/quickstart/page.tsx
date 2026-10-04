"use client";

import * as React from "react";
import { notFound } from "next/navigation";
import { installMockApi } from "@/app/dev/fixtures";
import { AppShell } from "@/components/app/app-shell";
import { QuickStartCard } from "@/components/app/quick-start-card";
import { useAppStore } from "@/lib/store";
import { useDraftStore } from "@/lib/draft-store";

installMockApi();

export default function DevQuickStartPage() {
  if (process.env.NODE_ENV === "production") notFound();
  React.useEffect(() => {
    useAppStore.getState().setView("dashboard");
    useDraftStore.getState().resetDraft();
  }, []);
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <QuickStartCard />
      </div>
    </AppShell>
  );
}
