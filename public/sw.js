// 足場信用プラットフォーム Service Worker（プッシュ通知の受信・クリック遷移）。
// オフラインキャッシュは行わない（証拠保全・鮮度重視のため常にネットワーク）。

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "足場信用プラットフォーム", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "足場信用プラットフォーム";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192x192.png",
    badge: "/badge.png",
    vibrate: [80, 40, 80],
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/home" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // 既に開いているタブがあれば、その場で該当URLへ。
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
