/* ==========================================================================
   BasaWisyo Service Worker - App Shell & Offline Caching (sw.js)
   Provides offline functionality for the reading companion.
   ========================================================================== */

const CACHE_NAME = "basawisyo-shell-v1";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./login.html",
  "./src/styles/base.css",
  "./src/styles/roles.css",
  "./src/styles/login.css",
  "./src/styles/visual-system.css",
  "./src/styles/reading-studio.css",
  "./src/styles/learning-dashboards.css",
  "./src/styles/header-redesign.css",
  "./src/styles/practice-management.css",
  "./src/styles/teacher-overview.css",
  "./src/styles/welcome-redesign.css",
  "./src/bundles/bundle-core-data.js",
  "./src/bundles/bundle-services.js",
  "./src/bundles/bundle-ui.js",
  "./src/utils/core.js",
  "./src/data/dictionary.js",
  "./src/data/passages.js",
  "./src/data/narrations.js",
  "./src/data/passage-schema.js",
  "./src/services/auth.js",
  "./src/pages/teacher.js",
  "./src/pages/admin.js",
  "./src/services/state.js",
  "./src/services/hearts.js",
  "./src/services/rewards.js",
  "./src/services/quests.js",
  "./src/services/bayanihan.js",
  "./src/services/review.js",
  "./src/services/flashcards.js",
  "./src/services/journey.js",
  "./src/services/board.js",
  "./src/services/rankings.js",
  "./src/services/mastery.js",
  "./src/utils/reading.js",
  "./src/components/navigation.js",
  "./src/components/shell.js",
  "./src/pages/home.js",
  "./src/pages/assess.js",
  "./src/pages/practice.js",
  "./src/pages/flashcards.js",
  "./src/pages/profile.js",
  "./src/pages/quest.js",
  "./src/pages/board.js",
  "./src/pages/reports.js",
  "./src/pages/parent.js",
  "./src/pages/about.js",
  "./src/pages/services.js",
  "./src/services/quiz.js",
  "./src/services/tutor.js",
  "./src/services/practice-helper.js",
  "./src/components/notifications.js",
  "./src/services/exports.js",
  "./src/services/backup.js",
  "./src/services/import-reader.js",
  "./src/services/material-storage.js",
  "./src/services/ai-question-generator.js",
  "./src/services/assignments.js",
  "./src/pages/reading-studio.js",
  "./src/pages/teacher-reading-studio.js",
  "./src/app.js",
  "./assets/images/wisyo.png",
  "./assets/images/welcome-book.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_FILES).catch(err => {
        // Non-blocking partial cache warning for assets
        console.warn("ServiceWorker app-shell cache warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Network-only for API chat routes with graceful offline fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: "Wisyo AI is currently offline.",
            message: "Online AI assistance requires an active connection. You can continue reading passages, taking quizzes, and using your trilingual dictionary offline!",
            offline: true
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // HTML documents / navigations: Network-First so UI updates load without stale cache traps
  if (event.request.mode === "navigate" || event.request.destination === "document" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  // App shell & static resources: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
