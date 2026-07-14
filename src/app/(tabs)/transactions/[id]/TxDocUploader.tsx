"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_DOCS_BUCKET } from "@/lib/projectDocsBucket";
import { DOCUMENT_TYPES, validateUpload } from "@/domain/projectDocs";
import { createTxDocUploadUrlAction, addTxDocumentAction } from "./docActions";

const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[13.5px]";
const lbl = "mb-1 block text-[12px] font-bold text-(--color-brand-sub)";
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 取引画面内でその場で資料を追加する（ページ遷移なし）。公開範囲は「選定会社のみ」に固定。 */
export function TxDocUploader({ projectId, txId }: { projectId: string; txId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("site_photo");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const pickFile = (f: File | null) => {
    setErr(null);
    if (!f) return setFile(null);
    const v = validateUpload(f.name, f.size);
    if (!v.ok) { setErr(v.error ?? "このファイルは追加できません"); setFile(null); if (fileRef.current) fileRef.current.value = ""; return; }
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const hash = await sha256Hex(file);
      const urlRes = await createTxDocUploadUrlAction(projectId, file.name, file.size);
      if (!urlRes.ok || !urlRes.path || !urlRes.token) { setErr(urlRes.error ?? "アップロード準備に失敗しました"); return; }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(PROJECT_DOCS_BUCKET).uploadToSignedUrl(urlRes.path, urlRes.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setErr(`アップロードに失敗しました: ${upErr.message}`); return; }
      const add = await addTxDocumentAction(txId, projectId, {
        storagePath: urlRes.path, fileName: file.name, mimeType: file.type || "application/octet-stream",
        fileSize: file.size, fileHash: hash, documentType: docType, description: desc.trim(),
      });
      if (!add.ok) { setErr(add.error ?? "追加に失敗しました"); return; }
      setFile(null); setDesc(""); if (fileRef.current) fileRef.current.value = "";
      setConfirm(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2 rounded-2xl border border-(--color-brand-line) bg-white p-3">
      <div className="mb-1.5 text-[12.5px] font-bold text-(--color-brand-ink)">この取引に資料を追加</div>
      <div className="mb-2 text-[11px] leading-relaxed text-(--color-brand-faint)">
        公開範囲は<span className="font-bold text-(--color-brand-purple)">選定会社のみ</span>で共有されます（固定）。
      </div>
      {err && <div className="mb-2 rounded-lg bg-(--color-brand-red-soft) px-3 py-1.5 text-[12px] font-semibold text-(--color-brand-red)">{err}</div>}
      <label className={`mb-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-(--color-brand-blue) bg-(--color-brand-blue-soft) px-3 py-2.5 text-[12.5px] font-bold text-(--color-brand-blue) ${busy ? "opacity-50" : ""}`}>
        <span aria-hidden>📎</span>{file ? file.name : "ファイルを選択（画像・PDF・Word・Excel・PowerPoint／25MBまで）"}
        <input ref={fileRef} type="file" className="hidden" disabled={busy} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      </label>
      {file && <div className="mb-2 text-[11px] text-(--color-brand-sub)">{fmtSize(file.size)}</div>}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={lbl}>資料種別</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
            {DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex-[1.4]">
          <label className={lbl}>説明（任意）</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例）追加の割付図" className={input} />
        </div>
      </div>
      <button disabled={!file || busy} onClick={() => setConfirm(true)} className="mt-2.5 w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
        {busy ? "アップロード中…" : "この資料を追加する"}
      </button>

      {confirm && file && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-[400px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-(--color-brand-ink)">この資料を追加しますか？</div>
            <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">
              <div>{file.name}（{fmtSize(file.size)}）</div>
              <div className="mt-1">種別：{DOCUMENT_TYPES.find((t) => t.key === docType)?.label} ／ 公開範囲：選定会社のみ</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
              <button onClick={doUpload} disabled={busy} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">{busy ? "追加中…" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
