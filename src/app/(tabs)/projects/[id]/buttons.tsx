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

function ConfirmOverlay({ title, message, pending, onConfirm, onClose }: { title: string; message: string; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[360px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-bold text-(--color-brand-ink)">{title}</div>
        <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">{message}</div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
          <button onClick={onConfirm} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
            {pending ? "処理中…" : "実行する"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApplyButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  const run = () =>
    start(async () => {
      const r = await applyAction(projectId);
      if (r.ok) {
        setOpen(false);
        show("応募しました", true);
        router.refresh();
      } else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button
        disabled={pending || disabled}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-(--color-brand-blue) py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
      >
        この案件に応募する
      </button>
      {open && <ConfirmOverlay title="この案件に応募しますか？" message="応募すると元請に通知され、選定を待ちます。" pending={pending} onConfirm={run} onClose={() => setOpen(false)} />}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}

export function SelectButton({ projectId, partnerId }: { projectId: string; partnerId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const show = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };
  const run = () =>
    start(async () => {
      const r = await selectPartnerAction(projectId, partnerId);
      if (r.ok) {
        setOpen(false);
        show("この会社に依頼しました（取引を作成）", true);
        router.refresh();
      } else show(r.error ?? "失敗しました", false);
    });
  return (
    <>
      <button
        disabled={pending}
        onClick={() => setOpen(true)}
        className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        この会社に依頼
      </button>
      {open && (
        <ConfirmOverlay
          title="この会社に依頼しますか？"
          message="選定すると取引が作成され、他の応募は締め切られます。この操作は取り消せません。"
          pending={pending}
          onConfirm={run}
          onClose={() => setOpen(false)}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}
