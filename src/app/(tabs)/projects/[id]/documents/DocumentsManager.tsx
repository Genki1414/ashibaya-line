"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_DOCS_BUCKET } from "@/lib/projectDocsBucket";
import { DOCUMENT_TYPES, VISIBILITY_LABEL, validateUpload, type DocVisibility } from "@/domain/projectDocs";
import type { ProjectDocView } from "@/server/projectDocs";
import { createDocUploadUrlAction, addDocumentAction, deleteDocumentAction, changeVisibilityAction, updateMetaAction, reorderAction } from "./actions";

const input = "w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[13.5px]";
const lbl = "mb-1 block text-[12px] font-bold text-(--color-brand-sub)";
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const VIS: DocVisibility[] = ["viewer", "applicant", "selected"];

function VisBadge({ v }: { v: DocVisibility }) {
  const color = v === "selected" ? "#6D4AC4" : v === "applicant" ? "#C77700" : "#159B67";
  const bg = v === "selected" ? "#EEE9FA" : v === "applicant" ? "#FCF2DF" : "#E4F6EE";
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color, background: bg }}>{VISIBILITY_LABEL[v]}</span>;
}

export function DocumentsManager({ projectId, docs }: { projectId: string; docs: ProjectDocView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // アップロード用ドラフト
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("site_photo");
  const [vis, setVis] = useState<DocVisibility>("viewer");
  const [desc, setDesc] = useState("");
  const [confirmAdd, setConfirmAdd] = useState(false);

  // 各操作モーダル
  const [editing, setEditing] = useState<ProjectDocView | null>(null);
  const [deleting, setDeleting] = useState<ProjectDocView | null>(null);

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
      const urlRes = await createDocUploadUrlAction(projectId, file.name, file.size);
      if (!urlRes.ok || !urlRes.path || !urlRes.token) { setErr(urlRes.error ?? "アップロード準備に失敗しました"); return; }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(PROJECT_DOCS_BUCKET).uploadToSignedUrl(urlRes.path, urlRes.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) { setErr(`アップロードに失敗しました: ${upErr.message}`); return; }
      const add = await addDocumentAction(projectId, {
        storagePath: urlRes.path, fileName: file.name, mimeType: file.type || "application/octet-stream",
        fileSize: file.size, fileHash: hash, documentType: docType, visibility: vis, description: desc.trim(),
      });
      if (!add.ok) { setErr(add.error ?? "追加に失敗しました"); return; }
      setFile(null); setDesc(""); if (fileRef.current) fileRef.current.value = "";
      setConfirmAdd(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const runDelete = (d: ProjectDocView) =>
    start(async () => {
      const r = await deleteDocumentAction(projectId, d.id);
      if (!r.ok) setErr(r.error ?? "削除に失敗しました");
      setDeleting(null);
      router.refresh();
    });

  const runReorder = (d: ProjectDocView, dir: "up" | "down") =>
    start(async () => { await reorderAction(projectId, d.id, dir); router.refresh(); });

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg bg-(--color-brand-red-soft) px-3 py-2 text-[12.5px] font-semibold text-(--color-brand-red)">{err}</div>}

      {/* 追加フォーム */}
      <div className="rounded-2xl border border-(--color-brand-line) bg-white p-3.5">
        <div className="mb-2 text-[13px] font-bold text-(--color-brand-ink)">資料を追加</div>
        <label className={`mb-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-(--color-brand-blue) bg-(--color-brand-blue-soft) px-3 py-2.5 text-[13px] font-bold text-(--color-brand-blue) ${busy ? "opacity-50" : ""}`}>
          <span aria-hidden>📎</span>{file ? file.name : "ファイルを選択（画像・PDF・Word・Excel・PowerPoint・テキスト／25MBまで）"}
          <input ref={fileRef} type="file" className="hidden" disabled={busy} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && <div className="mb-2 text-[11.5px] text-(--color-brand-sub)">{fmtSize(file.size)}</div>}
        <div className="flex gap-2">
          <div className="flex-1"><label className={lbl}>資料種別</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
              {DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex-1"><label className={lbl}>公開範囲</label>
            <select value={vis} onChange={(e) => setVis(e.target.value as DocVisibility)} className={input}>
              {VIS.map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2"><label className={lbl}>説明（任意）</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例）1階北面の割付図" className={input} /></div>
        <button disabled={!file || busy} onClick={() => setConfirmAdd(true)} className="mt-3 w-full rounded-xl bg-(--color-brand-blue) py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50">
          {busy ? "アップロード中…" : "この資料を追加する"}
        </button>
      </div>

      {/* 一覧 */}
      <div className="space-y-2.5">
        <div className="text-[12px] font-bold text-(--color-brand-faint)">登録済み資料（{docs.length}）</div>
        {docs.length === 0 && <div className="rounded-2xl border border-(--color-brand-line) bg-white p-5 text-center text-[12.5px] text-(--color-brand-sub)">まだ資料はありません。</div>}
        {docs.map((d, i) => (
          <div key={d.id} className="rounded-2xl border border-(--color-brand-line) bg-white p-3">
            <div className="flex gap-3">
              {d.previewable && d.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.url} alt={d.fileName} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-(--color-brand-bg) text-[20px]">{d.isImage ? "🖼" : d.isPdf ? "📄" : "📃"}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-(--color-brand-ink)">{d.fileName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-(--color-brand-bg) px-2 py-0.5 text-[10.5px] font-bold text-(--color-brand-sub)">{d.documentTypeLabel}</span>
                  <VisBadge v={d.visibility} />
                  <span className="text-[10.5px] text-(--color-brand-faint)">{fmtSize(d.fileSize)}</span>
                </div>
                {d.description && <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{d.description}</div>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-(--color-brand-line) pt-2">
              <button disabled={i === 0 || pending} onClick={() => runReorder(d, "up")} className="rounded-lg border border-(--color-brand-line) px-2 py-1 text-[12px] font-bold text-(--color-brand-sub) disabled:opacity-40">↑</button>
              <button disabled={i === docs.length - 1 || pending} onClick={() => runReorder(d, "down")} className="rounded-lg border border-(--color-brand-line) px-2 py-1 text-[12px] font-bold text-(--color-brand-sub) disabled:opacity-40">↓</button>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-(--color-brand-line) px-2.5 py-1 text-[12px] font-bold text-(--color-brand-blue)">開く</a>}
              <button onClick={() => setEditing(d)} className="rounded-lg border border-(--color-brand-line) px-2.5 py-1 text-[12px] font-bold text-(--color-brand-ink)">編集</button>
              <button onClick={() => setDeleting(d)} className="ml-auto rounded-lg border border-(--color-brand-red) px-2.5 py-1 text-[12px] font-bold text-(--color-brand-red)">削除</button>
            </div>
          </div>
        ))}
      </div>

      {confirmAdd && file && (
        <Modal title="この資料を追加しますか？" onClose={() => setConfirmAdd(false)}>
          <div className="text-[12.5px] text-(--color-brand-sub)">
            <div>{file.name}（{fmtSize(file.size)}）</div>
            <div className="mt-1">種別：{DOCUMENT_TYPES.find((t) => t.key === docType)?.label} ／ 公開範囲：{VISIBILITY_LABEL[vis]}</div>
          </div>
          <ModalButtons confirmLabel={busy ? "追加中…" : "追加する"} disabled={busy} onCancel={() => setConfirmAdd(false)} onConfirm={doUpload} />
        </Modal>
      )}

      {deleting && (
        <Modal title="この資料を削除しますか？" onClose={() => setDeleting(null)}>
          <div className="text-[12.5px] text-(--color-brand-sub)">
            「{deleting.fileName}」を一覧から削除します。<br />
            ※取引成立時に共有済みだった資料は、当該取引の相手・運営には履歴として残ります（証拠保全）。
          </div>
          <ModalButtons danger confirmLabel="削除する" disabled={pending} onCancel={() => setDeleting(null)} onConfirm={() => runDelete(deleting)} />
        </Modal>
      )}

      {editing && <EditModal projectId={projectId} doc={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-bold text-(--color-brand-ink)">{title}</div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function ModalButtons({ confirmLabel, onCancel, onConfirm, disabled, danger }: { confirmLabel: string; onCancel: () => void; onConfirm: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="mt-4 flex gap-2">
      <button onClick={onCancel} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
      <button onClick={onConfirm} disabled={disabled} className="flex-1 rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-50" style={{ background: danger ? "var(--color-brand-red)" : "var(--color-brand-blue)" }}>{confirmLabel}</button>
    </div>
  );
}

function EditModal({ projectId, doc, onClose, onDone }: { projectId: string; doc: ProjectDocView; onClose: () => void; onDone: () => void }) {
  const [fileName, setFileName] = useState(doc.fileName);
  const [docType, setDocType] = useState(doc.documentType);
  const [desc, setDesc] = useState(doc.description);
  const [vis, setVis] = useState<DocVisibility>(doc.visibility);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const save = () =>
    start(async () => {
      const meta = await updateMetaAction(projectId, doc.id, { fileName: fileName.trim() || doc.fileName, documentType: docType, description: desc });
      if (!meta.ok) { setErr(meta.error ?? "更新に失敗しました"); return; }
      if (vis !== doc.visibility) {
        const vr = await changeVisibilityAction(projectId, doc.id, vis);
        if (!vr.ok) { setErr(vr.error ?? "公開範囲の変更に失敗しました"); return; }
      }
      onDone();
    });

  return (
    <Modal title="資料を編集" onClose={onClose}>
      <div className="space-y-2.5">
        <div><label className={lbl}>ファイル名</label><input value={fileName} onChange={(e) => setFileName(e.target.value)} className={input} /></div>
        <div><label className={lbl}>資料種別</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
            {DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>公開範囲</label>
          <select value={vis} onChange={(e) => setVis(e.target.value as DocVisibility)} className={input}>
            {VIS.map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
          </select>
          {vis !== doc.visibility && <p className="mt-1 text-[11px] text-(--color-brand-faint)">※公開範囲の変更は監査履歴に記録されます（以前の公開範囲も残ります）。</p>}
        </div>
        <div><label className={lbl}>説明</label><input value={desc} onChange={(e) => setDesc(e.target.value)} className={input} /></div>
      </div>
      {err && <div className="mt-2 rounded-lg bg-(--color-brand-red-soft) px-3 py-1.5 text-[12px] font-semibold text-(--color-brand-red)">{err}</div>}
      <ModalButtons confirmLabel={pending ? "保存中…" : "保存する"} disabled={pending} onCancel={onClose} onConfirm={save} />
    </Modal>
  );
}
