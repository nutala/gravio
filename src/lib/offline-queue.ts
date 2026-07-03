const QUEUE_KEY = "gravio-mutation-queue";

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  createdAt: number;
}

export function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(mutation: Omit<QueuedMutation, "id" | "createdAt">) {
  const queue = getQueue();
  queue.push({ ...mutation, id: crypto.randomUUID(), createdAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(id: string) {
  const queue = getQueue().filter((m) => m.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function processQueue(): Promise<{ ok: number; fail: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { ok: 0, fail: 0 };
  let ok = 0;
  let fail = 0;
  for (const mutation of queue) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body ? JSON.stringify(mutation.body) : undefined,
      });
      if (res.ok) {
        removeFromQueue(mutation.id);
        ok++;
      } else {
        fail++;
      }
    } catch {
      fail++;
      break; // still offline, stop processing
    }
  }
  return { ok, fail };
}
