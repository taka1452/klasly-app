"use client";

import { useEffect, useState, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "unsupported";
  isLoading: boolean;
};

export function usePushNotifications(studioId?: string) {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    permission: "unsupported",
    isLoading: true,
  });

  // 初期状態チェック
  useEffect(() => {
    const checkSupport = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supported) {
        setState({
          isSupported: false,
          isSubscribed: false,
          permission: "unsupported",
          isLoading: false,
        });
        return;
      }

      const permission = Notification.permission;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          permission,
          isLoading: false,
        });
      } catch {
        setState({
          isSupported: true,
          isSubscribed: false,
          permission,
          isLoading: false,
        });
      }
    };

    checkSupport();
  }, []);

  // 購読開始
  const subscribe = useCallback(async () => {
    if (!state.isSupported) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          permission,
          isLoading: false,
        }));
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        console.error("VAPID public key not found");
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const appServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });

      // ArrayBuffer を base64 文字列に変換
      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      // サーバーにサブスクリプションを送信
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey("p256dh")!),
            auth: arrayBufferToBase64(subscription.getKey("auth")!),
          },
          studioId,
        }),
      });

      if (!response.ok) throw new Error("Failed to save subscription");

      setState({
        isSupported: true,
        isSubscribed: true,
        permission: "granted",
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Push subscription failed:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [state.isSupported, studioId]);

  // 購読解除
  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // サーバーで無効化
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setState({
        isSupported: true,
        isSubscribed: false,
        permission: Notification.permission,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Push unsubscribe failed:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}
