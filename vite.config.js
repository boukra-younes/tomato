import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + our own PwaUpdatePrompt component gives the user an
      // explicit "Refresh to update" action instead of the app silently
      // reloading mid-session, which is what autoUpdate can otherwise do.
      registerType: "prompt",
      // We register the service worker ourselves via virtual:pwa-register/react
      // in PwaUpdatePrompt.jsx, so don't also inject the default script.
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Healthy Tomato",
        short_name: "Tomato",
        description: "Complete nutrition, body, and health tracking platform",
        theme_color: "#1B4F4A",
        background_color: "#0c1110",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        categories: ["health", "fitness", "food"],
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/api\.nal\.usda\.gov\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "usda-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern:
              /^https:\/\/(world\.openfoodfacts\.org|images\.openfoodfacts\.org)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "off-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "supabase-data-cache",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
