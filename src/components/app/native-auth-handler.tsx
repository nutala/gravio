"use client";

import * as React from "react";
import { isNative, onAppUrlOpen } from "@/lib/native";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function NativeAuthHandler() {
  const router = useRouter();
  const [code, setCode] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "exchanging" | "done" | "error">("idle");

  // Listen for deep links from Google sign-in
  React.useEffect(() => {
    if (!isNative()) return;
    let cleanup: (() => void) | undefined;
    onAppUrlOpen((url) => {
      // calistrack://login?code=ABC123
      const m = url.match(/[?&]code=([A-Z0-9]+)/);
      if (m) {
        setCode(m[1]);
        setStatus("idle");
      }
    }).then((unsub) => { cleanup = unsub; });
    return () => cleanup?.();
  }, []);

  // Exchange the code for a session cookie
  React.useEffect(() => {
    if (!code || status !== "idle") return;
    setStatus("exchanging");
    fetch("/api/auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("done");
          toast.success("Connecté en tant que " + data.name);
          // Reload to pick up the session
          setTimeout(() => window.location.reload(), 500);
        } else {
          setStatus("error");
          toast.error(data.error || "Code invalide");
        }
      })
      .catch(() => {
        setStatus("error");
        toast.error("Erreur de connexion");
      });
  }, [code, status]);

  if (!isNative() || !code || status === "done") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="rounded-xl border bg-card p-8 text-center shadow-2xl max-w-sm">
        {status === "exchanging" ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Connexion en cours...</p>
          </>
        ) : status === "error" ? (
          <>
            <p className="mb-2 text-sm font-medium text-destructive">Code invalide ou expiré</p>
            <p className="text-xs text-muted-foreground">
              Retourne dans le navigateur et vérifie le code affiché.
            </p>
            <button
              onClick={() => { setCode(null); setStatus("idle"); }}
              className="mt-4 text-sm text-primary underline"
            >
              Réessayer
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
