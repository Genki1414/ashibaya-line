"use client";

import { useEffect, useState } from "react";
import { subscribeUser, unsubscribeUser, sendTestNotification } from "./actions";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "unconfigured" | "off" | "on";

/** プッシュ通知のオン/オフと動作確認（graceful degradation：非対応・未設定でも壊れず案内表示）。 */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!VAPID_PUBLIC) {
        if (!cancelled) setState("unconfigured");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSub(existing);
        setState(existing ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  };

  async function enable() {
    if (!VAPID_PUBLIC) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        flash("通知が許可されませんでした。ブラウザ設定から許可してください。");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      const serialized = JSON.parse(JSON.stringify(newSub));
      const res = await subscribeUser(serialized);
      if (!res.ok) {
        flash(res.error ?? "登録に失敗しました");
        await newSub.unsubscribe().catch(() => {});
        setBusy(false);
        return;
      }
      setSub(newSub);
      setState("on");
      flash("プッシュ通知をオンにしました。");
    } catch {
      flash("登録に失敗しました。");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = sub?.endpoint;
      await sub?.unsubscribe().catch(() => {});
      if (endpoint) await unsubscribeUser(endpoint);
      setSub(null);
      setState("off");
      flash("プッシュ通知をオフにしました。");
    } catch {
      flash("解除に失敗しました。");
    }
    setBusy(false);
  }

  async function test() {
    if (!sub?.endpoint) return;
    setBusy(true);
    const res = await sendTestNotification(sub.endpoint);
    flash(res.ok ? "テスト通知を送信しました。数秒以内に届きます。" : res.error ?? "送信に失敗しました");
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-2xl border border-(--color-brand-line) bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-[18px]" aria-hidden>🔔</span>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold text-(--color-brand-ink)">プッシュ通知</div>
          <div className="text-[11.5px] text-(--color-brand-sub)">応募・選定・受注・チャット・資料追加をお知らせします。</div>
        </div>
      </div>

      <div className="mt-3">
        {state === "loading" && <div className="text-[12px] text-(--color-brand-sub)">確認中…</div>}
        {state === "unsupported" && (
          <div className="text-[12px] text-(--color-brand-sub)">
            このブラウザ/端末はプッシュ通知に対応していません。iPhone は「ホーム画面に追加」してから開くと利用できます（iOS 16.4以降）。
          </div>
        )}
        {state === "unconfigured" && (
          <div className="text-[12px] text-(--color-brand-sub)">
            プッシュ通知はまだ有効化されていません（サーバのVAPID鍵が未設定）。設定後に利用できます。
          </div>
        )}
        {state === "off" && (
          <button onClick={enable} disabled={busy} className="w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50">
            {busy ? "設定中…" : "通知をオンにする"}
          </button>
        )}
        {state === "on" && (
          <div className="flex gap-2">
            <button onClick={test} disabled={busy} className="flex-1 rounded-xl border border-(--color-brand-blue) py-2.5 text-[13px] font-bold text-(--color-brand-blue) disabled:opacity-50">
              テスト通知
            </button>
            <button onClick={disable} disabled={busy} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[13px] font-bold text-(--color-brand-sub) disabled:opacity-50">
              オフにする
            </button>
          </div>
        )}
      </div>

      {msg && <div className="mt-2 rounded-lg bg-(--color-brand-blue-soft) px-3 py-2 text-[12px] text-(--color-brand-sub)">{msg}</div>}
    </div>
  );
}
