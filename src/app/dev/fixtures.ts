/**
 * DEV-ONLY fixtures + fetch shim for previewing the app UI without a backend.
 * Loaded by /dev/* routes. Never imported by production code.
 */
import type { ExerciseWithVariants, WorkoutTemplateFull } from "@/lib/types";
export const FIXTURE_EXERCISES = [
  {
    id: "ex-pompes",
    name: "Pompes",
    category: "Push",
    muscleGroup: "Pectoraux",
    isStatic: false,
    description: "Pompes classiques, corps gainé.",
    equipment: "Poids du corps",
    tags: ["Push"],
    variants: [
      { id: "v-pompes-inclinees", exerciseId: "ex-pompes", name: "Inclinées", difficultyLevel: 1, mode: "reps" },
      { id: "v-pompes-normales", exerciseId: "ex-pompes", name: "Normale (sol)", difficultyLevel: 3, mode: "reps" },
      { id: "v-pompes-declinees", exerciseId: "ex-pompes", name: "Déclinées", difficultyLevel: 5, mode: "reps" },
      { id: "v-pompes-archee", exerciseId: "ex-pompes", name: "Archée (pseudo-planche)", difficultyLevel: 7, mode: "reps" },
    ],
  },
  {
    id: "ex-tractions",
    name: "Tractions",
    category: "Pull",
    muscleGroup: "Dos / biceps",
    isStatic: false,
    description: "Tractions pronation.",
    equipment: "Barre",
    tags: ["Pull"],
    variants: [
      { id: "v-trac-australiennes", exerciseId: "ex-tractions", name: "Australiennes", difficultyLevel: 1, mode: "reps" },
      { id: "v-trac-normales", exerciseId: "ex-tractions", name: "Pronation", difficultyLevel: 4, mode: "reps" },
      { id: "v-trac-lestees", exerciseId: "ex-tractions", name: "Lestées", difficultyLevel: 7, mode: "reps" },
    ],
  },
  {
    id: "ex-planche",
    name: "Planche",
    category: "Static",
    muscleGroup: "Full body",
    isStatic: true,
    description: "Maintien isométrique de planche.",
    equipment: "Poids du corps",
    tags: ["Static", "Push"],
    variants: [
      { id: "v-pl-tuck", exerciseId: "ex-planche", name: "Tuck", difficultyLevel: 3, mode: "hold" },
      { id: "v-pl-adv-tuck", exerciseId: "ex-planche", name: "Advanced tuck", difficultyLevel: 5, mode: "hold" },
      { id: "v-pl-straddle", exerciseId: "ex-planche", name: "Straddle", difficultyLevel: 8, mode: "hold" },
      { id: "v-pl-full", exerciseId: "ex-planche", name: "Full planche", difficultyLevel: 10, mode: "hold" },
    ],
  },
  {
    id: "ex-lsit",
    name: "L-sit",
    category: "Core",
    muscleGroup: "Abdos",
    isStatic: true,
    description: "Maintien L-sit aux barres.",
    equipment: "Barres parallèles",
    tags: ["Core"],
    variants: [
      { id: "v-lsit-tuck", exerciseId: "ex-lsit", name: "Tuck", difficultyLevel: 2, mode: "hold" },
      { id: "v-lsit-one", exerciseId: "ex-lsit", name: "Une jambe", difficultyLevel: 4, mode: "hold" },
      { id: "v-lsit-full", exerciseId: "ex-lsit", name: "Full L-sit", difficultyLevel: 6, mode: "hold" },
    ],
  },
  {
    id: "ex-dips",
    name: "Dips",
    category: "Push",
    muscleGroup: "Triceps / pectoraux",
    isStatic: false,
    description: "Dips aux barres parallèles.",
    equipment: "Barres parallèles",
    tags: ["Push"],
    variants: [
      { id: "v-dips-banc", exerciseId: "ex-dips", name: "Sur banc", difficultyLevel: 1, mode: "reps" },
      { id: "v-dips-paralleles", exerciseId: "ex-dips", name: "Parallèles", difficultyLevel: 4, mode: "reps" },
      { id: "v-dips-lestees", exerciseId: "ex-dips", name: "Lestées", difficultyLevel: 7, mode: "reps" },
    ],
  },
  {
    id: "ex-squat",
    name: "Squat pistol",
    category: "Legs",
    muscleGroup: "Jambes",
    isStatic: false,
    description: "Squat une jambe (pistol).",
    equipment: "Poids du corps",
    tags: ["Legs"],
    variants: [
      { id: "v-squat-assiste", exerciseId: "ex-squat", name: "Assisté", difficultyLevel: 2, mode: "reps" },
      { id: "v-squat-pistol", exerciseId: "ex-squat", name: "Pistol", difficultyLevel: 5, mode: "reps" },
    ],
  },
  {
    id: "ex-combos",
    name: "Combos",
    category: "Combo",
    muscleGroup: "Full body",
    isStatic: false,
    description: "Enchaînement de plusieurs exercices à réaliser à la suite.",
    equipment: null,
    tags: [],
    variants: [],
  },
] as unknown as ExerciseWithVariants[];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const FIXTURE_WORKOUTS = [
  {
    id: "w-1",
    userId: "u-1",
    date: isoDaysAgo(3),
    title: "Push & planche",
    durationMin: 52,
    perceivedExertion: 8,
    bodyweightKg: 72,
    notes: "",
    createdAt: isoDaysAgo(3),
    updatedAt: isoDaysAgo(3),
    entries: [
      {
        id: "we-1",
        workoutId: "w-1",
        exerciseId: "ex-pompes",
        variantId: "v-pompes-declinees",
        supersetGroup: null,
        notes: "",
        comboSteps: [],
        comboWeightKg: null,
        comboRpe: null,
        comboValidated: null,
        exercise: FIXTURE_EXERCISES[0],
        variant: null,
        sets: [
          { id: "s-1", entryId: "we-1", variantId: "v-pompes-declinees", reps: 14, holdSeconds: null, weightKg: 10, rpe: null },
          { id: "s-2", entryId: "we-1", variantId: "v-pompes-declinees", reps: 12, holdSeconds: null, weightKg: 10, rpe: null },
          { id: "s-3", entryId: "we-1", variantId: "v-pompes-declinees", reps: 10, holdSeconds: null, weightKg: 10, rpe: null },
        ],
      },
    ],
  },
];

export const FIXTURE_TEMPLATES = [
  {
    id: "tpl-1",
    userId: "u-1",
    name: "Push A — Planche",
    notes: "Échauffement + force",
    createdAt: isoDaysAgo(30),
    updatedAt: isoDaysAgo(2),
    entries: [
      { id: "te-1", templateId: "tpl-1", exerciseId: "ex-pompes", exercise: FIXTURE_EXERCISES[0], variant: null, sets: [] },
      { id: "te-2", templateId: "tpl-1", exerciseId: "ex-dips", exercise: FIXTURE_EXERCISES[4], variant: null, sets: [] },
      { id: "te-3", templateId: "tpl-1", exerciseId: "ex-planche", exercise: FIXTURE_EXERCISES[2], variant: null, sets: [] },
    ],
  },
  {
    id: "tpl-2",
    userId: "u-1",
    name: "Pull B — Tractions",
    notes: "",
    createdAt: isoDaysAgo(20),
    updatedAt: isoDaysAgo(5),
    entries: [
      { id: "te-4", templateId: "tpl-2", exerciseId: "ex-tractions", exercise: FIXTURE_EXERCISES[1], variant: null, sets: [] },
      { id: "te-5", templateId: "tpl-2", exerciseId: "ex-lsit", exercise: FIXTURE_EXERCISES[3], variant: null, sets: [] },
    ],
  },
] as unknown as WorkoutTemplateFull[];

export const FIXTURE_LAST_SESSION: Record<string, { sets: { reps: number | null; holdSeconds: number | null; weightKg: number | null; rpe: number | null }[] }> = {
  "v-pompes-declinees": {
    sets: [
      { reps: 14, holdSeconds: null, weightKg: 10, rpe: null },
      { reps: 12, holdSeconds: null, weightKg: 10, rpe: null },
      { reps: 10, holdSeconds: null, weightKg: 10, rpe: null },
    ],
  },
  "v-pl-tuck": {
    sets: [
      { reps: null, holdSeconds: 20, weightKg: null, rpe: null },
      { reps: null, holdSeconds: 18, weightKg: null, rpe: null },
    ],
  },
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Install a fetch shim that serves fixtures for /api/* calls. */
export function installMockApi(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __gravioMock?: boolean };
  if (w.__gravioMock) return;
  w.__gravioMock = true;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    try {
      const u = new URL(url, window.location.origin);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.pathname.startsWith("/api/")) {
        if (u.pathname === "/api/exercises" && method === "GET") return json(FIXTURE_EXERCISES);
        if (u.pathname === "/api/exercises" && method === "POST") return json(FIXTURE_EXERCISES[0]);
        if (u.pathname === "/api/workouts" && method === "GET") return json(FIXTURE_WORKOUTS);
        if (u.pathname === "/api/templates" && method === "GET") return json(FIXTURE_TEMPLATES);
        if (u.pathname === "/api/sets/last-session") {
          const vid = u.searchParams.get("variantId") ?? "";
          return json(FIXTURE_LAST_SESSION[vid] ?? { sets: [] });
        }
        if (u.pathname === "/api/stats/overview") return json({});
        return json([]);
      }
    } catch {
      /* fall through to real fetch */
    }
    return realFetch(input as RequestInfo, init);
  };
}
