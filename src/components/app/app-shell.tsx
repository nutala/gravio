"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Dumbbell,
  PlusCircle,
  History,
  BarChart3,
  Activity,
} from "lucide-react";
import { useAppStore, type ViewId } from "@/lib/store";
import { GravioLogo } from "@/components/gravio-logo";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { RestTimerWidget } from "@/components/app/rest-timer-widget";
import { CustomRestTrigger } from "@/components/app/custom-rest-trigger";
import { PWAInstallPrompt } from "@/components/app/PWAInstallPrompt";
import { NetworkStatus } from "@/components/app/network-status";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const NAV: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }>; short: string }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, short: "Accueil" },
  { id: "exercises", label: "Exercices", icon: Dumbbell, short: "Exos" },
  { id: "new-workout", label: "Nouvelle séance", icon: PlusCircle, short: "Séance" },
  { id: "history", label: "Historique", icon: History, short: "Passé" },
  { id: "stats", label: "Statistiques", icon: BarChart3, short: "Stats" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  // The bottom tab bar stays available during a workout so an exercise can be
  // created (Exos tab) without losing the session — the draft persists. The
  // session action bar sits just above it.
  const showTabs = true;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <button
            onClick={() => setView("dashboard")}
            className="group flex items-center gap-2.5"
            aria-label="Aller au tableau de bord"
          >
            <GravioLogo className="h-16 w-auto object-contain transition-transform group-hover:scale-105 sm:h-20" />
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {NAV.map((item) => {
              const active = view === item.id;
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView(item.id)}
                  className={cn(
                    "gap-2 font-medium",
                    active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <CustomRestTrigger />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <div
          className={cn(
            "mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8",
            showTabs && "pb-28 md:pb-8",
          )}
        >
          {children}
        </div>
      </main>

      {/* Footer (desktop only — mobile has the tab bar) */}
      <footer className="mt-auto hidden border-t border-border/60 bg-background sm:block">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
            <p className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span className="font-medium">Gravio</span>
              <span className="opacity-60">·</span>
              <span>Suivi de performance calisthénie</span>
            </p>
            <p className="flex items-center gap-3 opacity-70">
              <Link href="/conditions" className="transition-colors hover:text-foreground">
                Conditions
              </Link>
              <span aria-hidden>·</span>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Confidentialité
              </Link>
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile bottom tab bar (thumb-reachable, app-like) */}
      {showTabs && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Navigation mobile"
        >
          <div className="flex h-14 items-stretch">
            {NAV.map((item) => {
              const active = view === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                  <span>{item.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Floating rest timer (persists across views) */}
      <RestTimerWidget />

      {/* Offline indicator */}
      <NetworkStatus />

      {/* PWA install prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
