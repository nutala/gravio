"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save, Settings, LogOut, User } from "lucide-react";
import { useUpdateProfile, useUploadAvatar } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export function ProfileView() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const profileMutation = useUpdateProfile();
  const avatarMutation = useUploadAvatar();
  const user = session?.user;

  const fileRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [preview, setPreview] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      if (!preview || !preview.startsWith("data:")) {
        setPreview(user.image ?? "");
      }
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Connecte-toi pour accéder à ton profil.
      </div>
    );
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 8 Mo).");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    fileRef.current!.value = "";

    try {
      const result = await avatarMutation.mutateAsync(file);
      setPreview(result.image);
      await update();
      router.refresh();
    } catch (err) {
      toast.error(
        (err as { message?: string })?.message ??
          "Format d'image non supporté. Utilise JPEG, PNG, WebP, GIF, AVIF ou HEIC.",
      );
      setPreview("");
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) return;

    const body: { name?: string; newPassword?: string } = {};
    if (name !== (user.name ?? "")) body.name = name;
    if (newPassword) body.newPassword = newPassword;
    if (Object.keys(body).length === 0) return;

    await profileMutation.mutateAsync(body);
    update();
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Mon Profil</h1>
          <p className="text-sm text-muted-foreground">
            Modifie tes informations personnelles
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo de profil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarMutation.isPending ? undefined : preview} alt={name} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              {avatarMutation.isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{name || "Utilisateur"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                disabled={avatarMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {avatarMutation.isPending ? "Upload..." : "Changer la photo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du compte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-name">Nom</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom"
              />
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                Changer le mot de passe (optionnel)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-password">Nouveau mot de passe</Label>
                  <Input
                    id="profile-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 caractères"
                    minLength={6}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-confirm">Confirmer</Label>
                  <Input
                    id="profile-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répète le mot de passe"
                  />
                </div>
              </div>
              {newPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-destructive">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={profileMutation.isPending}
                className="gap-2"
              >
                {profileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={() => useAppStore.getState().setView("settings")}
        >
          <Settings className="h-4 w-4" />
          Paramètres
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
