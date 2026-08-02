"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { BookOpen, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginDialog } from "@/components/app/login-dialog";
import { useAppStore } from "@/lib/store";

/** Build a 1-2 character initials string from a display name or email. */
function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "";
  if (!source) return "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu() {
  const { data: session, status } = useSession();
  const [loginOpen, setLoginOpen] = React.useState(false);

  // Loading state: subtle pulse placeholder.
  if (status === "loading") {
    return (
      <div
        className="h-9 w-9 animate-pulse rounded-full bg-muted"
        aria-label="Chargement de la session"
      />
    );
  }

  // Not authenticated: outline button that opens the LoginDialog.
  if (status === "unauthenticated" || !session?.user) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLoginOpen(true)}
          className="h-9"
        >
          Se connecter
        </Button>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  const user = session.user;
  const initials = getInitials(user.name ?? null, user.email ?? null);
  const displayName = user.name ?? "Utilisateur";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu utilisateur"
            className="rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {user.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {initials}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => useAppStore.getState().setView("profile")}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Mon Profil
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => useAppStore.getState().setView("guide")}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Guide
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
