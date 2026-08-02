"use client";

import * as React from "react";
import {
  ArrowLeft,
  BookOpen,
  LayoutDashboard,
  Dumbbell,
  PlusCircle,
  FileText,
  History,
  BarChart3,
  User,
  Check,
  Plus,
  Star,
  Target,
} from "lucide-react";
import { useAppStore, type ViewId } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ActionButton({
  target,
  children,
}: {
  target: ViewId;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => useAppStore.getState().setView(target)}
    >
      {children}
    </Button>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function GuideSection({
  icon: Icon,
  title,
  subtitle,
  items,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  items: string[];
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <FeatureList items={items} />
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

export function GuideView() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => useAppStore.getState().setView("dashboard")}
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Guide</h1>
          <p className="text-sm text-muted-foreground">
            Tout ce que tu peux faire avec Gravio, simplement.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <BookOpen className="h-5 w-5 shrink-0 text-primary" />
        <p>
          Gravio t&apos;aide à créer tes exercices, suivre tes séries et
          analyser ta progression en calisthénie. Voici toutes les
          fonctionnalités, organisées par écran.
        </p>
      </div>

      <GuideSection
        icon={LayoutDashboard}
        title="Tableau de bord"
        subtitle="Le point de départ : ta vue d'ensemble."
        items={[
          "Consulte tes statistiques clés : séances totales, temps d'entraînement, activité cette semaine.",
          "Suis ta progression : compare jusqu'à 2 exercices (ou variantes) sur un même graphique, jour après jour.",
          "Découvre tes exercices favoris et tes séances récentes.",
          "Visualise ton activité des 30 derniers jours et le volume par catégorie musculaire.",
        ]}
        actions={
          <ActionButton target="dashboard">
            <LayoutDashboard className="h-4 w-4" /> Faire le tour
          </ActionButton>
        }
      />

      <GuideSection
        icon={Dumbbell}
        title="Exercices & variantes"
        subtitle="Construis ta bibliothèque de mouvements et leurs progressions."
        items={[
          "Crée, modifie ou supprime un exercice (nom, catégorie, groupe musculaire, équipement).",
          "Classe tes exercices par catégories et filtre-les grâce aux pastilles colorées et à la recherche.",
          "Ajoute, modifie ou supprime une variante — ce sont les marches de progression d'un exercice (ex. Tuck → Straddle → Full).",
          "Pour chaque variante, choisis sa difficulté (1 à 5 étoiles), le mode de comptage (reps ou maintien en secondes) et un objectif.",
          "L'arbre de progression te montre la marche « En cours » — celle que tu utilises le plus récemment.",
        ]}
        actions={
          <ActionButton target="exercises">
            <Plus className="h-4 w-4" /> Gérer mes exercices
          </ActionButton>
        }
      />

      <GuideSection
        icon={PlusCircle}
        title="Nouvelle séance"
        subtitle="C'est ici que tu enregistres tout ton entraînement."
        items={[
          "Ajoute des exercices : le premier sera pré-rempli avec ta dernière performance.",
          "Ajoute, valide (✓) ou supprime une série. Ajuste ensuite les reps, le maintien, le poids (kg/lb) et le RPE.",
          "Choisis la variante de chaque série depuis l'arbre de progression.",
          "Lance un minuteur de repos entre les séries — il flotte sur toutes les vues.",
          "Relie deux exercices en superset pour les noter ensemble.",
          "Crée des Combos multi-étapes (plusieurs mouvements dans une série), chaque étape en ✓ ou ✗.",
          "Charge un template pour préparer une séance, ou rejoue une séance passée depuis l'historique.",
          "Travaille hors-ligne : tes séances sont mises en file d'attente et synchronisées au retour du réseau.",
          "Utilise les raccourcis clavier (cheatsheet) pour aller plus vite.",
        ]}
        actions={
          <ActionButton target="new-workout">
            <PlusCircle className="h-4 w-4" /> Nouvelle séance
          </ActionButton>
        }
      />

      <GuideSection
        icon={FileText}
        title="Templates"
        subtitle="Prépare tes séances types pour les relancer en un clic."
        items={[
          "Crée un nouveau template avec une série d'exercices prédéfinis.",
          "Édite un template pour modifier ses exercices.",
          "Utilise un template pour charger instantanément une séance complète.",
          "Supprime les templates dont tu n'as plus besoin.",
        ]}
        actions={
          <ActionButton target="templates">
            <FileText className="h-4 w-4" /> Mes templates
          </ActionButton>
        }
      />

      <GuideSection
        icon={History}
        title="Historique"
        subtitle="Retrouve et relis toutes tes séances passées."
        items={[
          "Parcours tes séances groupées par mois, avec recherche par titre ou exercice.",
          "Bascule en vue calendrier — les jours où tu t'es entraîné sont marqués d'un point.",
          "Déplie une séance pour voir le détail de chaque série (variante, valeur, kg, RPE).",
          "Modifie les informations d'une séance (titre, date, durée, RPE, poids, notes).",
          "Supprime une séance définitivement, ou refais-la d'un clic.",
        ]}
        actions={
          <ActionButton target="history">
            <History className="h-4 w-4" /> Voir l'historique
          </ActionButton>
        }
      />

      <GuideSection
        icon={BarChart3}
        title="Statistiques"
        subtitle="Analyse ton volume, ta régularité et tes records."
        items={[
          "Volume par catégorie, répartition et fréquence d'entraînement sur 30 jours.",
          "Carte d'activité (heatmap) pour visualiser l'intensité de ton volume.",
          "Records personnels : ta meilleure performance par exercice, variante et difficulté.",
          "Tendance du volume et temps sous tension sur la durée.",
        ]}
        actions={
          <ActionButton target="stats">
            <BarChart3 className="h-4 w-4" /> Voir les stats
          </ActionButton>
        }
      />

      <GuideSection
        icon={User}
        title="Mon profil & paramètres"
        subtitle="Personnalise ton compte et ton application."
        items={[
          "Ajoute une photo, modifie ton nom et ton mot de passe.",
          "Change la couleur d'accent de l'application.",
          "Choisis l'unité de poids (kg ou lb) pour tous l'affichage.",
          "Choisis un profil sonore pour les sons de validation, d'échec et de fin de repos.",
          "Déconnecte-toi de ton compte Gravio.",
        ]}
        actions={
          <ActionButton target="profile">
            <User className="h-4 w-4" /> Mon profil
          </ActionButton>
        }
      />
    </div>
  );
}