"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAction, selectPartnerAction } from "../actions";

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-lg"
      style={{ background: ok ? "var(--color-brand-green)" : "var(--color-brand-red)" }}
    >
      {msg}
    </div>
  );
}

export function ApplyButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  return (
    <>
      <button
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await applyAction(projectId);
            if (r.ok) {
              show("応募しました", true);
              router.refresh();
            } else show(r.error ?? "失敗しました", false);
          })
        }
        className="w-full rounded-xl bg-(--color-brand-blue) py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "応募中…" : "この案件に応募する"}
      </button>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

export function SelectButton({ projectId, partnerId }: { projectId: string; partnerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  return (
    <>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await selectPartnerAction(projectId, partnerId);
            if (r.ok) {
              show("この会社に依頼しました（取引を作成）", true);
              router.refresh();
            } else show(r.error ?? "失敗しました", false);
          })
        }
        className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {pending ? "処理中…" : "この会社に依頼"}
      </button>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}
