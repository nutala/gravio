"use client";

import * as React from "react";
import { installMockApi } from "@/app/dev/fixtures";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { useAppStore } from "@/lib/store";

installMockApi();

export default function DevShellPage() {
  if (process.env.NODE_ENV === "production") notFound();
  React.useEffect(() => {
    useAppStore.getState().setView("history");
  }, []);
  return (
    <AppShell>
      <div className="py-20 text-center text-sm text-muted-foreground">
        Aperçu de la coquille (barre d'onglets bas)
      </div>
    </AppShell>
  );
}
