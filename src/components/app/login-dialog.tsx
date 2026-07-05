"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GravioLogo } from "@/components/gravio-logo";

type DemoAccount = {
  name: string;
  email: string;
  image: string;
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Alex Athlète",
    email: "alex.athlete@gmail.com",
    image: "https://i.pravatar.cc/150?img=68",
  },
  {
    name: "Sophie Street Workout",
    email: "sophie.sw@gmail.com",
    image: "https://i.pravatar.cc/150?img=45",
  },
];

function CaliLogo({ className }: { className?: string }) {
  return <GravioLogo className={`h-10 w-10 rounded-xl ${className ?? ""}`.trim()} showTagline taglineClassName="text-[7px]" />;
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type AuthMode = "choose" | "login" | "register";

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [googleConfigured, setGoogleConfigured] = React.useState<boolean | null>(null);
  const [mode, setMode] = React.useState<AuthMode>("choose");
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data: { google?: boolean; demo?: boolean }) => {
        if (!cancelled) setGoogleConfigured(!!data.google);
      })
      .catch(() => {
        if (!cancelled) setGoogleConfigured(false);
      });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!open) {
      setMode("choose");
      setPendingEmail(null);
      setLoginEmail("");
      setLoginPassword("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
    }
  }, [open]);

  async function handleDemo(account: DemoAccount) {
    setPendingEmail(account.email);
    try {
      const res = await signIn("google-demo", {
        email: account.email, name: account.name, image: account.image, redirect: false,
      });
      if (!res || res.error) throw new Error(res?.error || "Échec de la connexion");
      toast.success(`Bienvenue, ${account.name} !`);
      onOpenChange(false);
      window.setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la connexion");
      setPendingEmail(null);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Email et mot de passe requis");
      return;
    }
    setPendingEmail(loginEmail);
    try {
      const res = await signIn("email", {
        email: loginEmail.trim(), password: loginPassword, redirect: false,
      });
      if (!res || res.error) throw new Error(res?.error || "Email ou mot de passe incorrect");
      toast.success("Connecté !");
      onOpenChange(false);
      window.setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la connexion");
      setPendingEmail(null);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword || regPassword.length < 6) {
      toast.error("Email valide et mot de passe (min 6 caractères) requis");
      return;
    }
    setPendingEmail(regEmail);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail.trim(), password: regPassword, name: regName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'inscription");
      toast.success("Compte créé ! Connecte-toi.");
      setPendingEmail(null);
      setMode("login");
      setLoginEmail(regEmail.trim());
      setLoginPassword("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'inscription");
      setPendingEmail(null);
    }
  }

  async function handleGoogle() {
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec Google");
    }
  }

  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/api/auth/callback/google`
    : "/api/auth/callback/google";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <CaliLogo className="h-20 w-20" />
          </div>
          <DialogTitle className="text-center">
            {mode === "register" ? "Créer un compte" : "Se connecter"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "register"
              ? "Inscris-toi pour suivre tes progrès sur Gravio."
              : mode === "login"
                ? "Connecte-toi avec ton email et mot de passe."
                : "Choisis une méthode pour continuer sur Gravio."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="flex flex-col gap-2">
            {googleConfigured && (
              <>
                <Button onClick={handleGoogle} variant="outline" className="h-11 w-full gap-3">
                  <GoogleLogo className="h-4 w-4" />
                  Se connecter avec Google
                </Button>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <Button onClick={() => setMode("login")} variant="outline" className="h-11 w-full gap-3">
              <Mail className="h-4 w-4" />
              Email & mot de passe
            </Button>

            <div className="flex items-center justify-between px-1 pt-1">
              <p className="text-xs font-medium text-muted-foreground">Comptes démo</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Mode démo
              </span>
            </div>

            {DEMO_ACCOUNTS.map((acc) => {
              const isPending = pendingEmail === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleDemo(acc)}
                  disabled={pendingEmail !== null}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <img src={acc.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{acc.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{acc.email}</p>
                  </div>
                  {isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                </button>
              );
            })}

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setMode("register")}
              disabled={pendingEmail !== null}
            >
              Créer un compte
            </Button>

            {googleConfigured === false && (
              <div className="mt-1 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Google OAuth non configuré</p>
                <p className="mt-1 leading-relaxed">
                  Ajoutez <code className="rounded bg-muted px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_ID</code> et{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">GOOGLE_CLIENT_SECRET</code> dans .env
                </p>
                <p className="mt-2 leading-relaxed">URI de redirection :</p>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-[11px] text-foreground">
                  {redirectUri}
                </code>
              </div>
            )}
          </div>
        ) : mode === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" placeholder="vous@exemple.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-password">Mot de passe</Label>
              <Input id="login-password" type="password" placeholder="••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <Button type="submit" disabled={pendingEmail !== null} className="h-10 w-full gap-2">
                {pendingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                Se connecter
              </Button>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("register")} disabled={pendingEmail !== null}>
                  Créer un compte
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("choose")} disabled={pendingEmail !== null}>
                  Retour
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reg-name">Nom (optionnel)</Label>
              <Input id="reg-name" placeholder="Votre nom" value={regName} onChange={(e) => setRegName(e.target.value)} autoComplete="name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" placeholder="vous@exemple.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-password">Mot de passe</Label>
              <Input id="reg-password" type="password" placeholder="Minimum 6 caractères" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} autoComplete="new-password" required minLength={6} />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <Button type="submit" disabled={pendingEmail !== null} className="h-10 w-full gap-2">
                {pendingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer mon compte
              </Button>
              <div className="flex justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("login")} disabled={pendingEmail !== null}>
                  Déjà un compte
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("choose")} disabled={pendingEmail !== null}>
                  Retour
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}