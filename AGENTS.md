# AGENTS.md — gravio (application « Calisthenics Tracker »)

> Application de suivi sportif orientée calisthénie. **Le dossier s'appelle `gravio`, le
> produit non** — `package.json` porte encore le nom du scaffold (`nextjs_tailwind_shadcn_ts`).

## En bref

| | |
|---|---|
| Rôle | Suivi d'entraînement : exercices, variantes, séances, séries, statistiques |
| Dépôt | `git@github.com:nutala/gravio.git`, branche **main** |
| Stack | Next.js 16 + TypeScript, Tailwind 4, shadcn/ui, Prisma (SQLite), Recharts, Zustand, TanStack Query |
| Mobile | Capacitor (`android/`, `capacitor.config.ts`) |
| Contexte de référence | `worklog.md` à la racine — schéma, vues, routes API |

## Vues et API (d'après `worklog.md`)

Cinq vues sur `/` avec navigation par onglets : Dashboard, Exercises, New Workout, History,
Stats. Routes API : `/api/exercises`, `/api/exercises/[id]`, `/api/exercises/[id]/variants`,
`/api/variants/[id]`, `/api/workouts`, `/api/workouts/[id]`, `/api/stats/overview`,
`/api/stats/exercise-progress`.

## Modèles Prisma

`User`, `Category`, `Exercise`, `ExerciseVariant`, `Workout`, `WorkoutEntry`, `WorkoutSet`,
`WorkoutTemplate`, `WorkoutTemplateEntry`.

## Commandes

```bash
npm install
npm run dev          # Next.js en développement
npm run build && npm start
npm run lint
npm run db:push      # applique le schéma Prisma
npm run db:generate
npm run db:migrate
npm run db:reset     # DESTRUCTIF — efface et recrée la base
```

## Règles

1. **`npm run db:reset` efface des données d'entraînement réelles** : ne jamais le lancer sans
   accord explicite, et copier le fichier SQLite avant toute migration.
2. `agent-ctx/`, `tool-results/`, `download/` et `mini-services/` sont des dossiers de travail
   d'outils, pas du code produit : ne pas les nettoyer ni les committer sans vérifier.
3. Le serveur (`Caddyfile`) et la cible de déploiement ne sont pas documentés : **à confirmer
   avec Jordan** avant toute mise en ligne.
4. Aucun README ne décrit le projet : `worklog.md` fait office de référence. Si une décision
   structurante est prise, l'écrire là.

## À compléter

- Où l'app est-elle déployée (web et Android) ?
- Le nom public du produit (« Gravio » ? « Calisthenics Tracker » ?)
- Un `README.md` court serait utile : ce fichier ne remplace pas une doc produit.
