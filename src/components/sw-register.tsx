"use client";
import * as React from "react";

const CURRENT_BUILD = "4";

export function SwRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Force-clear old caches from previous builds
    if ("caches" in window) {
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k.startsWith("gravio-") && !k.includes(CURRENT_BUILD); })
            .map(function (k) { return caches.delete(k); })
        );
      }).catch(function () {});
    }

    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }, []);

  return null;
}
