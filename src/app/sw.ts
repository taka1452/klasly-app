import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  CacheFirst,
  StaleWhileRevalidate,
  NetworkFirst,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // =============================================
    // 1. 静的アセット（CSS/JS/画像）— Cache First
    // =============================================
    {
      matcher: /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$/i,
      handler: new CacheFirst({
        cacheName: "klasly-static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30日
          }),
        ],
      }),
    },
    // =============================================
    // 2. API レスポンス（スケジュール・クラス）— Stale While Revalidate
    //    → キャッシュを即座に返しつつ、裏でネットワークから最新を取得
    // =============================================
    {
      matcher: /\/api\/(studio|bookings|classes|sessions|schedule)/i,
      handler: new StaleWhileRevalidate({
        cacheName: "klasly-api-data",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5分
          }),
        ],
      }),
    },
    // =============================================
    // 3. Supabase API コール — Network First
    //    → ネットワークを優先、失敗時にキャッシュを使用
    // =============================================
    {
      matcher: /supabase\.co/i,
      handler: new NetworkFirst({
        cacheName: "klasly-supabase",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5分
          }),
        ],
      }),
    },
    // =============================================
    // 4. ページナビゲーション — Network First
    // =============================================
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "klasly-pages",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 24 * 60 * 60, // 24時間
          }),
        ],
      }),
    },
    // デフォルトキャッシュルールも追加（Serwist推奨設定）
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
