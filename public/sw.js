self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

let timerEndsAt = 0;
let timerInterval = null;

function startTimerCheck() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timerEndsAt <= 0) return;
    if (Date.now() >= timerEndsAt) {
      timerEndsAt = 0;
      self.registration.showNotification("Repos terminé ! 💪", {
        body: "C'est reparti pour une série !",
        tag: "rest-timer",
        silent: false,
        vibrate: [200, 100, 200],
        requireInteraction: true,
      });
    }
  }, 1000);
}

function stopTimerCheck() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndsAt = 0;
}

self.addEventListener("message", (e) => {
  const { type, remainingSec, endsAt } = e.data || {};

  if (type === "SHOW_NOTIFICATION") {
    self.registration.showNotification("Repos terminé ! 💪", {
      body: "C'est reparti pour une série !",
      tag: "rest-timer",
      silent: false,
      vibrate: [200, 100, 200],
    });
  }

  if (type === "UPDATE_REST_TIMER") {
    if (endsAt) timerEndsAt = endsAt;
    startTimerCheck();

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
    stopTimerCheck();
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
