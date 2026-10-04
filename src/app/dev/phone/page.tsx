"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";

/**
 * Phone-frame wrapper: renders a dev page inside an iframe so that
 * `position: fixed` elements (bottom bars, tab bar) constrain to the
 * emulated 390×844 viewport instead of the real window.
 */
function PhoneInner() {
  const params = useSearchParams();
  const p = params.get("p") ?? "workout";
  return (
    <div className="flex min-h-screen items-start justify-center bg-neutral-800 p-6">
      <div className="overflow-hidden rounded-[2rem] border-4 border-neutral-700 bg-background shadow-2xl">
        <iframe
          src={`/dev/${p}`}
          title="preview"
          style={{ width: 390, height: 844, border: 0 }}
        />
      </div>
      <p className="ml-6 pt-2 text-xs text-neutral-400">/dev/{p} · 390×844</p>
    </div>
  );
}

export default function DevPhonePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <React.Suspense fallback={null}>
      <PhoneInner />
    </React.Suspense>
  );
}
