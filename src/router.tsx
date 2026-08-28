import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// داخل Capacitor (أو أي بناء للجوال) نستخدم التوجيه بالهاش (#/) لضمان عمل جميع
// المسارات بدون خادم يعيد كتابة الروابط.
function shouldUseHashRouting(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env["VITE_HASH_ROUTER"] === "1") return true;
  const protocol = window.location.protocol;
  if (protocol === "file:" || protocol === "capacitor:") return true;
  return Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(shouldUseHashRouting() ? { history: createHashHistory() } : {}),
  });

  return router;
};
