"use client";

import * as React from "react";
import { WifiOff, CloudUpload } from "lucide-react";
import { processQueue, getQueue } from "@/lib/offline-queue";
import { toast } from "sonner";

export function NetworkStatus() {
  const [offline, setOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  React.useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      const count = getQueue().length;
      if (count > 0) {
        processQueue().then(({ ok }) => {
          if (ok > 0) {
            toast.success(`${ok} modification${ok > 1 ? "s" : ""} synchronisée${ok > 1 ? "s" : ""} 📡`);
          }
        });
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 backdrop-blur dark:text-amber-300">
      <WifiOff className="h-3.5 w-3.5" />
      Mode hors ligne
    </div>
  );
}
