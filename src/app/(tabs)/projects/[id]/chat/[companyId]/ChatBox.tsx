"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/server/chatData";
import { CHAT_BUCKET } from "@/lib/chatBucket";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction, markChatReadAction, createChatUploadUrl } from "./actions";

type Actor = "prime" | "partner";

const timeOf = (iso: string) => {
  const d = iso.includes("T") ? iso : iso.replace(" ", "T");
  const [date, time] = d.split("T");
  const [, m, day] = (date ?? "").split("-");
  const hm = (time ?? "").slice(0, 5);
  if (!m || !day) return hm;
  return `${Number(m)}/${Number(day)} ${hm}`;
};

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const MAX_BYTES = 25 * 1024 * 1024;

export function ChatBox({
  projectId,
  partnerCompanyId,
  role,
  messages,
  counterpartyReadAt,
  embedded = false,
}: {
  projectId: string;
  partnerCompanyId: string;
  role: Actor;
  messages: ChatMessage[];
  counterpartyReadAt: string | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void markChatReadAction(projectId, partnerCompanyId);
  }, [projectId, partnerCompanyId, messages.length]);

  const readMs = counterpartyReadAt ? new Date(counterpartyReadAt).getTime() : null;
  let lastReadMineId: string | null = null;
  if (readMs != null) {
    for (const m of messages) {
      if (m.senderRole === role && new Date(m.createdAt).getTime() <= readMs) lastReadMineId = m.id;
    }
  }

  const submit = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      const r = await sendMessageAction(projectId, partnerCompanyId, body);
      if (r.ok) {
        setText("");
        setError(null);
        router.refresh();
      } else setError(r.error ?? "送信に失敗しました");
    });
  };

  const onPickFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("ファイルサイズは25MBまでです");
      return;
    }
    setUploading(true);
    try {
      const urlRes = await createChatUploadUrl(projectId, partnerCompanyId, file.name, file.size);
      if (!urlRes.ok || !urlRes.path || !urlRes.token) {
        setError(urlRes.error ?? "アップロードの準備に失敗しました");
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(CHAT_BUCKET).uploadToSignedUrl(urlRes.path, urlRes.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) {
        setError(`アップロードに失敗しました: ${upErr.message}`);
        return;
      }
      const send = await sendMessageAction(projectId, partnerCompanyId, text.trim(), {
        path: urlRes.path,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
      if (send.ok) {
        setText("");
        router.refresh();
      } else setError(send.error ?? "送信に失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const busy = pending || uploading;

  return (
    <div className={embedded ? "flex flex-col overflow-hidden rounded-2xl border border-(--color-brand-line) bg-(--color-brand-bg)" : "flex min-h-[calc(100dvh-56px)] flex-col"}>
      <div className={embedded ? "max-h-72 space-y-2.5 overflow-y-auto p-3" : "flex-1 space-y-2.5 p-4"}>
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
                  {m.attachment && (
                    <div className={`overflow-hidden rounded-2xl ${mine ? "" : "border border-(--color-brand-line)"}`}>
                      {m.attachment.isImage ? (
                        <a href={m.attachment.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.attachment.url} alt={m.attachment.name} className="max-h-60 w-auto object-cover" />
                        </a>
                      ) : (
                        <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white px-3 py-2.5">
                          <span className="text-[18px]" aria-hidden>📎</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold text-(--color-brand-blue)">{m.attachment.name}</span>
                            <span className="block text-[11px] text-(--color-brand-sub)">{fmtSize(m.attachment.size)}・ダウンロード</span>
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                  {m.text && (
                    <div
                      className={`${m.attachment ? "mt-1 " : ""}rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed`}
                      style={{
                        background: mine ? "var(--color-brand-blue)" : "#fff",
                        color: mine ? "#fff" : "var(--color-brand-ink)",
                        border: mine ? "none" : "1px solid var(--color-brand-line)",
                      }}
                    >
                      {m.text}
                    </div>
                  )}
                  <div className={`mt-0.5 flex items-center gap-1.5 text-[10.5px] text-(--color-brand-faint) ${mine ? "justify-end" : "justify-start"}`}>
                    {mine && m.id === lastReadMineId && <span className="font-bold text-(--color-brand-blue)">既読</span>}
                    <span>{m.senderRole === "prime" ? "元請" : "協力"}・{timeOf(m.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`border-t border-(--color-brand-line) bg-white p-3 ${embedded ? "" : "sticky bottom-0"}`}>
        {error && <div className="mb-2 rounded-lg bg-(--color-brand-red-soft) px-3 py-1.5 text-[12px] font-semibold text-(--color-brand-red)">{error}</div>}
        <div className="flex items-end gap-2">
          <label
            title="写真・ファイルを添付"
            className={`flex shrink-0 items-center gap-1 rounded-2xl border border-(--color-brand-line) px-3 py-2.5 text-[13px] font-bold text-(--color-brand-sub) ${busy ? "opacity-50" : "cursor-pointer"}`}
          >
            <span className="text-[16px] leading-none" aria-hidden>{uploading ? "…" : "📎"}</span>
            <span>添付</span>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
          </label>
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
            disabled={busy || !text.trim()}
            className="shrink-0 rounded-2xl bg-(--color-brand-blue) px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "送信中" : "送信"}
          </button>
        </div>
      </div>
    </div>
  );
}
