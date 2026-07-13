"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/server/chatData";
import { sendMessageAction, markChatReadAction } from "./actions";

type Actor = "prime" | "partner";

const timeOf = (iso: string) => {
  // "2026-07-13T05:20:00Z" → "7/13 14:20"（表示はローカル簡易整形）
  const d = iso.includes("T") ? iso : iso.replace(" ", "T");
  const [date, time] = d.split("T");
  const [, m, day] = (date ?? "").split("-");
  const hm = (time ?? "").slice(0, 5);
  if (!m || !day) return hm;
  return `${Number(m)}/${Number(day)} ${hm}`;
};

export function ChatBox({
  projectId,
  partnerCompanyId,
  role,
  messages,
}: {
  projectId: string;
  partnerCompanyId: string;
  role: Actor;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 開いた時点で既読にする（他画面の未読バッジをクリア）。
  useEffect(() => {
    void markChatReadAction(projectId, partnerCompanyId);
  }, [projectId, partnerCompanyId, messages.length]);

  const submit = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      const r = await sendMessageAction(projectId, partnerCompanyId, body);
      if (r.ok) {
        setText("");
        setError(null);
        router.refresh();
      } else {
        setError(r.error ?? "送信に失敗しました");
      }
    });
  };

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <div className="flex-1 space-y-2.5 p-4">
        {messages.length === 0 ? (
          <div className="mt-8 text-center text-[12.5px] text-(--color-brand-sub)">
            まだメッセージはありません。<br />募集の相談・条件確認などにご利用ください。
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === role;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[78%]">
                  <div
                    className="rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed"
                    style={{
                      background: mine ? "var(--color-brand-blue)" : "#fff",
                      color: mine ? "#fff" : "var(--color-brand-ink)",
                      border: mine ? "none" : "1px solid var(--color-brand-line)",
                    }}
                  >
                    {m.text}
                  </div>
                  <div className={`mt-0.5 text-[10.5px] text-(--color-brand-faint) ${mine ? "text-right" : "text-left"}`}>
                    {m.senderRole === "prime" ? "元請" : "協力"}・{timeOf(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 border-t border-(--color-brand-line) bg-white p-3">
        {error && <div className="mb-2 rounded-lg bg-(--color-brand-red-soft) px-3 py-1.5 text-[12px] font-semibold text-(--color-brand-red)">{error}</div>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={1}
            placeholder="メッセージを入力"
            className="max-h-28 flex-1 resize-none rounded-2xl border border-(--color-brand-line) px-3.5 py-2 text-[14px]"
          />
          <button
            onClick={submit}
            disabled={pending || !text.trim()}
            className="shrink-0 rounded-2xl bg-(--color-brand-blue) px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "送信中" : "送信"}
          </button>
        </div>
      </div>
    </div>
  );
}
