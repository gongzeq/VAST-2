/*
 * Mock Service Worker stub.
 *
 * In real dev, run `npx msw init public/ --save` to generate a real worker file.
 * This stub allows the package to be served without a generated worker; MSW
 * will gracefully fall back to logging if the worker is missing.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
