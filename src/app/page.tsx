"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { useAppStore } from "@/lib/store";
import { DashboardView } from "@/components/app/views/dashboard-view";
import { ExercisesView } from "@/components/app/views/exercises-view";
import { ExerciseDetailView } from "@/components/app/views/exercise-detail-view";
import { NewWorkoutView } from "@/components/app/views/new-workout-view";
import { HistoryView } from "@/components/app/views/history-view";
import { StatsView } from "@/components/app/views/stats-view";
import { ProfileView } from "@/components/app/views/profile-view";
import { TemplatesView } from "@/components/app/views/templates-view";
import { TemplateEditorView } from "@/components/app/views/template-editor-view";
import { SettingsView } from "@/components/app/views/settings-view";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const view = useAppStore((s) => s.view);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell>
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ViewRouter view={view} />
      </React.Suspense>
    </AppShell>
  );
}

function ViewRouter({ view }: { view: ReturnType<typeof useAppStore.getState>["view"] }) {
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "exercises":
      return <ExercisesView />;
    case "exercise-detail":
      return <ExerciseDetailView />;
    case "new-workout":
      return <NewWorkoutView />;
    case "history":
      return <HistoryView />;
    case "stats":
      return <StatsView />;
    case "profile":
      return <ProfileView />;
    case "settings":
      return <SettingsView />;
    case "templates":
      return <TemplatesView />;
    case "template-editor":
      return <TemplateEditorView />;
    default:
      return <DashboardView />;
  }
}
