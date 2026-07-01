self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("message", (e) => {
  const { type, remainingSec } = e.data || {};

  if (type === "SHOW_NOTIFICATION") {
    self.registration.showNotification("Repos terminé ! 💪", {
      body: "C'est reparti pour une série !",
      tag: "rest-timer",
      silent: false,
      vibrate: [200, 100, 200],
    });
  }

  if (type === "UPDATE_REST_TIMER") {
    if (remainingSec <= 0) {
      self.registration.showNotification("Repos terminé ! 💪", {
        body: "C'est reparti pour une série !",
        tag: "rest-timer",
        silent: false,
        vibrate: [200, 100, 200],
        requireInteraction: true,
      });
    } else {
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      self.registration.showNotification(`Repos ${timeStr}`, {
        body: `Temps restant : ${timeStr}`,
        tag: "rest-timer",
        silent: true,
        requireInteraction: true,
      });
    }
    return;
  }

  if (type === "CLOSE_REST_TIMER") {
    self.registration.getNotifications({ tag: "rest-timer" }).then((ns) => {
      ns.forEach((n) => n.close());
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.notification.tag === "rest-timer") {
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
        if (cs.length > 0) {
          cs[0].focus();
          cs[0].postMessage({ type: "FOCUS_WORKOUT" });
        } else {
          clients.openWindow("/");
        }
      }),
    );
  }
});
