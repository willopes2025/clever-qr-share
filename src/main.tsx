import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove legacy service workers/caches to avoid stale auth flows on mobile.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    Promise.all([
      navigator.serviceWorker.getRegistrations(),
      'caches' in window ? caches.keys() : Promise.resolve([]),
    ])
      .then(async ([registrations, cacheKeys]) => {
        await Promise.all([
          ...registrations.map((registration) => registration.unregister()),
          ...cacheKeys.map((cacheKey) => caches.delete(cacheKey)),
        ]);

        if (registrations.length > 0 || cacheKeys.length > 0) {
          console.log('Legacy offline cache cleared');
        }
      })
      .catch((error) => {
        console.warn('Failed to clear legacy offline cache:', error);
      });
  });
}
