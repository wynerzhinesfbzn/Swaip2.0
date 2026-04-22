import { useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications(userHash: string | null) {
  const subscribed = useRef(false);

  useEffect(() => {
    if (!userHash || subscribed.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        /* 1. Получаем VAPID public key */
        const r = await fetch(`${BASE}/api/push/vapid-public-key`);
        if (!r.ok) return;
        const { publicKey } = await r.json();
        if (!publicKey) return;

        /* 2. Регистрируем SW */
        const reg = await navigator.serviceWorker.ready;

        /* 3. Проверяем, есть ли уже подписка */
        let sub = await reg.pushManager.getSubscription();

        /* 4. Если нет — запрашиваем разрешение и подписываемся */
        if (!sub) {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled) return;

        /* 5. Отправляем подписку на сервер */
        const subJson = sub.toJSON() as {
          endpoint: string;
          keys?: { p256dh: string; auth: string };
        };
        await fetch(`${BASE}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
        });

        subscribed.current = true;
      } catch (e) {
        console.warn("[push] subscribe failed", e);
      }
    })();

    return () => { cancelled = true; };
  }, [userHash]);
}
