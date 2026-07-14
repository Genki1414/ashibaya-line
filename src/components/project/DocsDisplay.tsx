import type { ReactNode } from "react";
import { VISIBILITY_LABEL, type DocVisibility } from "@/domain/projectDocs";
import type { ProjectDocView, TxDocView } from "@/server/projectDocs";

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

function VisBadge({ v }: { v: DocVisibility }) {
  const color = v === "selected" ? "#6D4AC4" : v === "applicant" ? "#C77700" : "#159B67";
  const bg = v === "selected" ? "#EEE9FA" : v === "applicant" ? "#FCF2DF" : "#E4F6EE";
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color, background: bg }}>{VISIBILITY_LABEL[v]}</span>;
}

/** 画像=サムネイル、HEIC/PDF/Office=アイコン＋名称。PDFは別タブ、それ以外はダウンロード。 */
function Thumb({ d }: { d: { url: string | null; fileName: string; previewable: boolean; isImage: boolean; isPdf: boolean; isHeic: boolean } }) {
  if (d.previewable && d.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.url} alt={d.fileName} className="h-14 w-14 shrink-0 rounded-lg object-cover" />;
  }
  const icon = d.isHeic ? "🖼" : d.isImage ? "🖼" : d.isPdf ? "📄" : "📃";
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-(--color-brand-bg) text-[20px]">{icon}</div>;
}

function OpenLink({ url, isPdf, isHeic }: { url: string | null; isPdf: boolean; isHeic: boolean }) {
  if (!url) return null;
  const label = isPdf ? "別タブで開く" : isHeic ? "ダウンロードして確認" : "ダウンロード";
  return <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-(--color-brand-line) px-2.5 py-1 text-[12px] font-bold text-(--color-brand-blue)">{label}</a>;
}

/** 案件詳細の資料一覧（閲覧のみ。公開範囲でフィルタ済みのものを受け取る）。 */
export function ProjectDocsReadonly({ docs }: { docs: ProjectDocView[] }) {
  if (docs.length === 0) return null;
  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="rounded-2xl border border-(--color-brand-line) bg-white p-3">
          <div className="flex gap-3">
            <Thumb d={d} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-(--color-brand-ink)">{d.fileName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-(--color-brand-bg) px-2 py-0.5 text-[10px] font-bold text-(--color-brand-sub)">{d.documentTypeLabel}</span>
                <VisBadge v={d.visibility} />
                <span className="text-[10px] text-(--color-brand-faint)">{fmtSize(d.fileSize)}</span>
              </div>
              {d.description && <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{d.description}</div>}
              {d.isHeic && <div className="mt-1 text-[11px] text-(--color-brand-faint)">HEIC画像（端末により表示できない場合はダウンロードして確認）</div>}
              <div className="mt-1.5"><OpenLink url={d.url} isPdf={d.isPdf} isHeic={d.isHeic} /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_LABEL = { current: "現在公開中", deleted: "現在は削除済み" } as const;

/**
 * 取引詳細の資料セクション。成立前からの資料／成立後に追加／既存取引の移行資料を分けて表示。常に表示。
 * uploaderSlot を渡すと（元請のみ）先頭にその場追加フォームを出す。取引後に追加した資料も共有される。
 */
export function TxDocsSection({ docs, uploaderSlot }: { docs: TxDocView[]; uploaderSlot?: ReactNode }) {
  if (docs.length === 0) {
    return (
      <div>
        {uploaderSlot}
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-center text-[12.5px] text-(--color-brand-sub)">現在共有されている案件資料はありません。</div>
      </div>
    );
  }
  const before = docs.filter((d) => d.origin === "before");
  const after = docs.filter((d) => d.origin === "after");
  const migrated = docs.filter((d) => d.origin === "migrated");

  const Row = ({ d }: { d: TxDocView }) => (
    <div className="rounded-2xl border border-(--color-brand-line) bg-white p-3">
      <div className="flex gap-3">
        <Thumb d={d} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-(--color-brand-ink)">{d.fileName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-(--color-brand-bg) px-2 py-0.5 text-[10px] font-bold text-(--color-brand-sub)">{d.documentTypeLabel}</span>
            <VisBadge v={d.visibility} />
            <span className="text-[10px] text-(--color-brand-faint)">{fmtSize(d.fileSize)}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: d.status === "current" ? "#159B67" : "#8A93A3", background: d.status === "current" ? "#E4F6EE" : "#EEF1F5" }}
            >
              {STATUS_LABEL[d.status]}
            </span>
          </div>
          {d.description && <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{d.description}</div>}
          {d.isHeic && <div className="mt-1 text-[11px] text-(--color-brand-faint)">HEIC画像（端末により表示できない場合はダウンロードして確認）</div>}
          <div className="mt-1.5"><OpenLink url={d.url} isPdf={d.isPdf} isHeic={d.isHeic} /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {uploaderSlot}
      {before.length > 0 && (
        <div>
          <div className="mb-1.5 text-[12px] font-bold text-(--color-brand-faint)">取引成立前からの資料（成立時点で共有済み）</div>
          <div className="space-y-2">{before.map((d, i) => <Row key={`b${i}`} d={d} />)}</div>
        </div>
      )}
      {after.length > 0 && (
        <div>
          <div className="mb-1.5 text-[12px] font-bold text-(--color-brand-faint)">取引成立後に追加された資料</div>
          <div className="space-y-2">{after.map((d, i) => <Row key={`a${i}`} d={d} />)}</div>
        </div>
      )}
      {migrated.length > 0 && (
        <div>
          <div className="mb-1.5 text-[12px] font-bold text-(--color-brand-faint)">現在共有中の資料（成立時点の共有状況は未確認）</div>
          <p className="mb-1.5 text-[11px] leading-relaxed text-(--color-brand-faint)">
            この取引は資料機能の追加より前に成立したため、成立時点で共有されていたかは確認できません。現在公開中の資料を表示しています。
          </p>
          <div className="space-y-2">{migrated.map((d, i) => <Row key={`m${i}`} d={d} />)}</div>
        </div>
      )}
    </div>
  );
}
