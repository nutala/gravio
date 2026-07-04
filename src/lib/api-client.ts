import { addToQueue } from "./offline-queue";

/**
 * Lightweight typed fetcher for the API routes.
 * Adds JSON headers, error handling, and JSON parsing.
 */
export class QueuedOfflineError extends Error {
  constructor() {
    super("Request queued for offline sync");
    this.name = "QueuedOfflineError";
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText) || "Request failed";
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

async function requestWithQueue<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  try {
    return await request<T>(url, options);
  } catch (err) {
    // Queue non-GET requests on network error for later replay
    if (
      options?.method &&
      options.method !== "GET" &&
      err instanceof TypeError
    ) {
      addToQueue({
        url,
        method: options.method as "POST" | "PUT" | "PATCH" | "DELETE",
        body: options.body ? JSON.parse(options.body as string) : undefined,
      });
      throw new QueuedOfflineError();
    }
    throw err;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url, { method: "GET" }),
  post: <T>(url: string, body?: unknown) =>
    requestWithQueue<T>(url, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(url: string, body?: unknown) =>
    requestWithQueue<T>(url, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(url: string, body?: unknown) =>
    requestWithQueue<T>(url, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(url: string) => requestWithQueue<T>(url, { method: "DELETE" }),
};

/** Query keys for TanStack Query cache invalidation. */
export const qk = {
  exercises: ["exercises"] as const,
  exercise: (id: string) => ["exercises", id] as const,
  exerciseRecords: (id: string) => ["exercises", id, "records"] as const,
  workouts: ["workouts"] as const,
  workout: (id: string) => ["workouts", id] as const,
  categories: ["categories"] as const,
  overview: ["stats", "overview"] as const,
  topExercises: ["stats", "top-exercises"] as const,
  progress: (exerciseId: string, variantId?: string | null) =>
    ["stats", "progress", exerciseId, variantId ?? "any"] as const,
  templates: ["templates"] as const,
  template: (id: string) => ["templates", id] as const,
};
