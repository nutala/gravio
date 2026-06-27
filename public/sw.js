self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("message", (e) => {
  if (e.data?.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification("Repos terminé ! 💪", {
      body: "C'est reparti pour une série !",
      tag: "rest-timer",
      silent: false,
      vibrate: [200, 100, 200],
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      if (cs.length > 0) {
        cs[0].focus();
      } else {
        clients.openWindow("/");
      }
    }),
  );
});
