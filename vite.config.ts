// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// بناء الجوال (Capacitor): MOBILE=1 → مخرجات ثابتة في dist بدون خادم.
const isMobileBuild = process.env["MOBILE"] === "1";

export default defineConfig({
  // في بناء الجوال نعطّل nitro/cloudflare لأن الناتج ملفات ثابتة فقط.
  ...(isMobileBuild ? { nitro: false as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    ...(isMobileBuild ? {} : { server: { entry: "server" } }),
    // وضع SPA: لا تصيير على الخادم — غلاف HTML واحد وكل شيء يُصيَّر في المتصفح.
    ...(isMobileBuild
      ? {
          spa: {
            enabled: true,
            prerender: { crawlLinks: false, outputPath: "/index.html" },
          },
        }
      : {}),
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        outDir: "dist/client",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globDirectory: "dist/client",
          globPatterns: ["**/*.{js,css,html,png,jpg,svg,ico,woff,woff2,json,webmanifest,mp3,wav,ogg}"],
          navigateFallback: "/index.html",
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "tibyan-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 30 },
              },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && ["style", "script", "worker", "font", "image"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "tibyan-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              },
            },
          ],
        },
      }),
    ],
  },
});
