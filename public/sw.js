// ── Cache names ──────────────────────────────────────────────
var BUILD_ID = "4";
var STATIC_CACHE = "gravio-static-v" + BUILD_ID;
var API_CACHE = "gravio-api-v" + BUILD_ID;
var NAV_CACHE = "gravio-nav-v" + BUILD_ID;

// ── Install: precache shell + skip waiting ──────────────────
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function () { return self.skipWaiting(); }),
  );
});

// ── Activate: clean old caches + take control ───────────────
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) {
            return k.startsWith("gravio-") && k !== STATIC_CACHE && k !== API_CACHE && k !== NAV_CACHE;
          })
          .map(function (k) { return caches.delete(k); }),
      );
    }).then(function () { return clients.claim(); }),
  );
});

// ── Fetch strategy ──────────────────────────────────────────
self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);

  // Only handle GET, same-origin requests
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // API: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Never cache sw.js itself — must be fetched fresh for update detection
  if (url.pathname === "/sw.js") return;

  // Next.js static assets (JS, CSS): stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }

  // Navigation: network-first with cached fallback
  if (req.mode === "navigate") {
    e.respondWith(navFirst(req));
    return;
  }

  // Other static files (images, fonts, icons): stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|webp|avif)$/)) {
    e.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }
});

function networkFirst(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return fetch(req).then(function (res) {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function () {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        return new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      });
    });
  });
}

function cacheFirst(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
    });
  });
}

function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (res) {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
      return cached || fetchPromise;
    });
  });
}

function navFirst(req) {
  return caches.open(NAV_CACHE).then(function (cache) {
    return fetch(req).then(function (res) {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function () {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        // Try the root page as last resort
        return caches.match("/");
      });
    });
  });
}

// ── Rest timer ──────────────────────────────────────────────
var timerEndsAt = 0;
var timerInterval = null;
var repeatInterval = null;

var VIBE_ALARM = [400, 150, 400, 150, 200, 150, 600, 200, 600];

function notifyTimerEnd() {
  self.registration.showNotification("⏱ Repos terminé ! 💪", {
    body: "C'est reparti pour une série !",
    tag: "rest-timer",
    silent: false,
    vibrate: VIBE_ALARM,
    renotify: true,
    requireInteraction: true,
  });
  // Wake up any client so it can play the sound
  self.clients.matchAll({ type: "window" }).then(function (cs) {
    cs.forEach(function (c) { c.postMessage({ type: "REST_TIMER_ENDED" }); });
  });
}

function startRepeatNotify() {
  if (repeatInterval) return;
  repeatInterval = setInterval(function () {
    if (timerEndsAt > 0) return;
    self.registration.getNotifications({ tag: "rest-timer" }).then(function (ns) {
      if (ns.length === 0) { stopRepeatNotify(); return; }
      notifyTimerEnd();
    });
  }, 6000);
}

function stopRepeatNotify() {
  if (repeatInterval) {
    clearInterval(repeatInterval);
    repeatInterval = null;
  }
}

function startTimerCheck() {
  if (timerInterval) return;
  timerInterval = setInterval(function () {
    if (timerEndsAt <= 0) return;
    if (Date.now() >= timerEndsAt) {
      timerEndsAt = 0;
      notifyTimerEnd();
      startRepeatNotify();
    }
  }, 1000);
}

function stopTimerCheck() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndsAt = 0;
  stopRepeatNotify();
}

self.addEventListener("message", function (e) {
  var data = e.data || {};
  var type = data.type;
  var remainingSec = data.remainingSec;
  var endsAt = data.endsAt;

  if (type === "SHOW_NOTIFICATION") {
    notifyTimerEnd();
  }

  if (type === "UPDATE_REST_TIMER") {
    if (endsAt) timerEndsAt = endsAt;
    startTimerCheck();

    if (remainingSec <= 0) {
      notifyTimerEnd();
      startRepeatNotify();
    } else {
      var m = Math.floor(remainingSec / 60);
      var s = remainingSec % 60;
      var timeStr = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      self.registration.showNotification("⏱ Repos " + timeStr, {
        body: "Temps restant : " + timeStr,
        tag: "rest-timer",
        silent: true,
        requireInteraction: true,
      });
    }
    return;
  }

  if (type === "CLOSE_REST_TIMER") {
    stopTimerCheck();
    self.registration.getNotifications({ tag: "rest-timer" }).then(function (ns) {
      ns.forEach(function (n) { n.close(); });
    });
  }
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  if (e.notification.tag === "rest-timer") {
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
        if (cs.length > 0) {
          cs[0].focus().catch(function () {});
          cs[0].postMessage({ type: "FOCUS_WORKOUT" });
        }
        // In Capacitor, clients.openWindow is not supported. Skip silently.
      }),
    );
  }
});
