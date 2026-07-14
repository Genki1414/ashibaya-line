/**
 * 案件資料（図面・写真・書類）のドメイン規則。
 * チャット添付とは別管理。公開範囲・tier 判定・ファイル検証などの純粋ロジックを集約する。
 * 実体（Storage）・DB アクセス・署名URLはサーバ層（src/server/projectDocs.ts）が担う。
 */

export type DocumentType =
  | "site_photo" | "scaffold_drawing" | "floor_plan" | "elevation"
  | "schedule" | "spec" | "safety" | "other";

export const DOCUMENT_TYPES: readonly { key: DocumentType; label: string }[] = [
  { key: "site_photo", label: "現場写真" },
  { key: "scaffold_drawing", label: "足場図面" },
  { key: "floor_plan", label: "平面図" },
  { key: "elevation", label: "立面図" },
  { key: "schedule", label: "工程表" },
  { key: "spec", label: "仕様書" },
  { key: "safety", label: "安全書類" },
  { key: "other", label: "その他" },
];

export const DOCUMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.key, d.label]));

/** 公開範囲（狭い順に selected > applicant > viewer）。 */
export type DocVisibility = "viewer" | "applicant" | "selected";

export const VISIBILITY_LABEL: Record<DocVisibility, string> = {
  viewer: "案件閲覧者に公開",
  applicant: "応募会社に公開",
  selected: "選定会社にのみ公開",
};

/** 閲覧者の案件に対する関係。none＝未ログイン/無関係。 */
export type ViewerTier = "none" | "viewer" | "applicant" | "selected" | "prime";

export interface ViewerRelation {
  readonly isLoggedIn: boolean;
  readonly isPrime: boolean;
  readonly isSelected: boolean;
  readonly isApplicant: boolean;
}

/** 関係から tier を決める（強い方を優先）。未ログインは none。 */
export function resolveTier(r: ViewerRelation): ViewerTier {
  if (!r.isLoggedIn) return "none";
  if (r.isPrime) return "prime";
  if (r.isSelected) return "selected";
  if (r.isApplicant) return "applicant";
  return "viewer"; // ログイン済みの登録会社（案件詳細を閲覧できる）
}

/** その公開範囲の資料を、その tier の閲覧者が見られるか。未ログイン(none)は常に不可。 */
export function canViewDocument(visibility: DocVisibility, tier: ViewerTier): boolean {
  switch (tier) {
    case "prime":
    case "selected":
      return true; // 元請・選定会社は全公開範囲を閲覧可
    case "applicant":
      return visibility === "viewer" || visibility === "applicant";
    case "viewer":
      return visibility === "viewer";
    case "none":
    default:
      return false;
  }
}

// ── ファイル検証（許可リスト方式：未知の実行形式を確実に排除） ──

export const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25MB

type FileCategory = "image" | "pdf" | "office" | "text";

const ALLOWED_EXT: Record<string, { mime: string; category: FileCategory; previewable: boolean }> = {
  jpg: { mime: "image/jpeg", category: "image", previewable: true },
  jpeg: { mime: "image/jpeg", category: "image", previewable: true },
  png: { mime: "image/png", category: "image", previewable: true },
  gif: { mime: "image/gif", category: "image", previewable: true },
  webp: { mime: "image/webp", category: "image", previewable: true },
  heic: { mime: "image/heic", category: "image", previewable: false }, // ブラウザ非対応の可能性→DL誘導
  pdf: { mime: "application/pdf", category: "pdf", previewable: false },
  doc: { mime: "application/msword", category: "office", previewable: false },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", category: "office", previewable: false },
  xls: { mime: "application/vnd.ms-excel", category: "office", previewable: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "office", previewable: false },
  ppt: { mime: "application/vnd.ms-powerpoint", category: "office", previewable: false },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", category: "office", previewable: false },
  csv: { mime: "text/csv", category: "office", previewable: false },
  txt: { mime: "text/plain", category: "text", previewable: false },
};

export function extensionOf(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  if (!base.includes(".")) return "";
  return base.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface UploadValidation {
  readonly ok: boolean;
  readonly error?: string;
  readonly ext?: string;
  readonly category?: FileCategory;
}

/** アップロード可否（許可リスト＋サイズ）。危険な実行形式は許可外なので拒否される。 */
export function validateUpload(filename: string, size: number): UploadValidation {
  const ext = extensionOf(filename);
  const spec = ALLOWED_EXT[ext];
  if (!spec) return { ok: false, error: "この形式のファイルは添付できません（画像・PDF・Word・Excel・PowerPoint・テキストのみ）" };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "ファイルサイズが不正です" };
  if (size > MAX_DOC_BYTES) return { ok: false, error: "ファイルサイズは25MBまでです" };
  return { ok: true, ext, category: spec.category };
}

/** サムネイル表示できる画像か（HEIC はブラウザ非対応の可能性があるため false）。 */
export function isPreviewableImage(filenameOrExt: string): boolean {
  const ext = filenameOrExt.includes(".") || filenameOrExt.length > 4 ? extensionOf(filenameOrExt) : filenameOrExt.toLowerCase();
  return ALLOWED_EXT[ext]?.category === "image" && ALLOWED_EXT[ext]?.previewable === true;
}

export function isHeic(filenameOrExt: string): boolean {
  const ext = filenameOrExt.includes(".") || filenameOrExt.length > 4 ? extensionOf(filenameOrExt) : filenameOrExt.toLowerCase();
  return ext === "heic";
}

export function isImage(filenameOrExt: string): boolean {
  const ext = filenameOrExt.includes(".") || filenameOrExt.length > 4 ? extensionOf(filenameOrExt) : filenameOrExt.toLowerCase();
  return ALLOWED_EXT[ext]?.category === "image";
}

export function isPdf(filenameOrExt: string): boolean {
  const ext = filenameOrExt.includes(".") || filenameOrExt.length > 4 ? extensionOf(filenameOrExt) : filenameOrExt.toLowerCase();
  return ext === "pdf";
}

/** 監査アクション種別。 */
export type DocAuditAction =
  | "add" | "delete" | "replace" | "visibility_change"
  | "description_change" | "type_change" | "reorder" | "url_issued";
