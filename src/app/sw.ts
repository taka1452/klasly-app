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

// =============================================
// Web Push 通知ハンドラー
// =============================================

// Push イベント: サーバーからの通知を受信して表示
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/badge-72x72.png",
      tag: data.tag || "klasly-notification",
      renotify: true,
      data: {
        url: data.url || "/",
        ...data.data,
      },
      actions: [
        {
          action: "open",
          title: "Open",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    } as NotificationOptions;

    event.waitUntil(
      self.registration.showNotification(data.title || "Klasly", options)
    );
  } catch {
    // JSON パース失敗時はプレーンテキストとして表示
    event.waitUntil(
      self.registration.showNotification("Klasly", {
        body: event.data?.text() ?? "",
        icon: "/icons/icon-192x192.png",
      })
    );
  }
});

// 通知クリック: 指定されたURLを開く
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // 既に開いているタブがあればそこにフォーカス
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // なければ新しいタブで開く
        return self.clients.openWindow(url);
      })
  );
});

// サブスクリプション変更時: 自動再登録
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/vapid-key")
      .then((res) => res.json())
      .then(({ publicKey }) =>
        self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        })
      )
      .then((subscription) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        })
      )
  );
});

serwist.addEventListeners();
