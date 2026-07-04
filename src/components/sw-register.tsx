"use client";
import * as React from "react";
import { isNative } from "@/lib/native";

export function SwRegister() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator && !isNative()) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
