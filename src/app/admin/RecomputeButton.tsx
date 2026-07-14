"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recomputeAllPerformanceAction } from "./actions";

/** 全社の実績データを再計算する（確認を挟む）。数値は常にイベントから再集計され、手編集はできない。 */
export function RecomputeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = () =>
    start(async () => {
      const r = await recomputeAllPerformanceAction();
      setMsg(r.ok ? (r.message ?? "再計算しました") : (r.error ?? "失敗しました"));
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-(--color-brand-blue) bg-(--color-brand-blue-soft) px-3 py-1.5 text-[12.5px] font-bold text-(--color-brand-blue)"
        >
          実績データを全社再計算
        </button>
        {msg && <span className="text-[12px] text-(--color-brand-sub)">{msg}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[360px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-(--color-brand-ink)">実績データの全社再計算</div>
            <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">
              全会社の実績を取引イベントから再集計して上書きします。数値の手編集はできません（イベントからの再計算のみ）。
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">
                キャンセル
              </button>
              <button onClick={run} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
                {pending ? "再計算中…" : "実行する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
