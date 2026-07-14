import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { currentCompanyId } from "./acting";
import { getAuthContext } from "./auth";
import { rowToProject, type ProjectRow } from "../infra/supabase/mappers";
import { PROJECT_DOCS_BUCKET } from "../lib/projectDocsBucket";
import {
  canViewDocument,
  resolveTier,
  validateUpload,
  isPreviewableImage,
  isImage,
  isPdf,
  isHeic,
  DOCUMENT_TYPE_LABEL,
  MAX_DOC_BYTES,
  type DocAuditAction,
  type DocVisibility,
  type ViewerTier,
} from "../domain/projectDocs";

export { PROJECT_DOCS_BUCKET };

export interface DocsResult {
  ok: boolean;
  error?: string;
}

function adminOrNull(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

interface DocRow {
  id: string;
  project_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  file_hash: string | null;
  document_type: string;
  visibility: DocVisibility;
  description: string;
  sort_order: number;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ProjectDocView {
  id: string;
  fileName: string;
  documentType: string;
  documentTypeLabel: string;
  visibility: DocVisibility;
  description: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
  url: string | null;
  isImage: boolean;
  previewable: boolean;
  isPdf: boolean;
  isHeic: boolean;
}

function toView(r: DocRow, url: string | null): ProjectDocView {
  return {
    id: r.id,
    fileName: r.file_name,
    documentType: r.document_type,
    documentTypeLabel: DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type,
    visibility: r.visibility,
    description: r.description,
    fileSize: r.file_size,
    mimeType: r.mime_type,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    url,
    isImage: isImage(r.file_name),
    previewable: isPreviewableImage(r.file_name),
    isPdf: isPdf(r.file_name),
    isHeic: isHeic(r.file_name),
  };
}

async function loadProject(admin: SupabaseClient, projectId: string) {
  const { data } = await admin.from("projects").select("state").eq("id", projectId).maybeSingle();
  return data ? rowToProject(data as unknown as ProjectRow) : null;
}

async function isSelectedPartner(admin: SupabaseClient, projectId: string, companyId: string): Promise<boolean> {
  const { data } = await admin.from("transactions").select("id").eq("project_id", projectId).eq("partner_id", companyId).limit(1).maybeSingle();
  return Boolean(data);
}

async function signedMap(admin: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(paths)].filter(Boolean);
  if (uniq.length === 0) return map;
  const { data } = await admin.storage.from(PROJECT_DOCS_BUCKET).createSignedUrls(uniq, 60 * 60);
  for (const s of data ?? []) {
    const row = s as { path?: string | null; signedUrl?: string };
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

async function audit(admin: SupabaseClient, action: DocAuditAction, projectId: string, documentId: string | null, detail: Record<string, unknown>) {
  const actorCompany = await currentCompanyId();
  const ctx = await getAuthContext();
  await admin.from("project_document_audit").insert({
    document_id: documentId,
    project_id: projectId,
    action,
    actor_company: actorCompany,
    actor_user: ctx.user?.id ?? null,
    detail,
  });
}

/** 元請本人であることを確認し、案件を返す。資料の追加/削除/変更はすべてこれを通す。 */
async function requirePrime(projectId: string): Promise<{ ok: true; admin: SupabaseClient; me: string } | { ok: false; error: string }> {
  const admin = adminOrNull();
  if (!admin) return { ok: false, error: "資料機能が未設定です（SUPABASE_SERVICE_ROLE_KEY）" };
  const me = await currentCompanyId();
  if (!me) return { ok: false, error: "ログインが必要です" };
  const project = await loadProject(admin, projectId);
  if (!project) return { ok: false, error: "案件が見つかりません" };
  if ((project.primeId as unknown as string) !== me) return { ok: false, error: "案件資料を操作できるのは元請のみです" };
  return { ok: true, admin, me };
}

/** 閲覧者の tier と、公開範囲に応じて閲覧可能な資料一覧（署名付きURL付き）。 */
export interface LoadProjectDocsResult {
  tier: ViewerTier;
  canManage: boolean;
  docs: ProjectDocView[];
}

export async function loadProjectDocuments(projectId: string, viewerCompanyId: string | null): Promise<LoadProjectDocsResult> {
  const admin = adminOrNull();
  if (!admin) return { tier: "none", canManage: false, docs: [] };
  const project = await loadProject(admin, projectId);
  if (!project) return { tier: "none", canManage: false, docs: [] };

  const isPrime = viewerCompanyId != null && (project.primeId as unknown as string) === viewerCompanyId;
  const isApplicant = viewerCompanyId != null && project.applicantIds.some((a) => (a as unknown as string) === viewerCompanyId);
  const isSelected = viewerCompanyId != null && (await isSelectedPartner(admin, projectId, viewerCompanyId));
  const tier = resolveTier({ isLoggedIn: viewerCompanyId != null, isPrime, isSelected, isApplicant });

  if (tier === "none") return { tier, canManage: false, docs: [] };

  const { data } = await admin
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as DocRow[];
  const visible = rows.filter((r) => canViewDocument(r.visibility, tier));
  const urls = await signedMap(admin, visible.map((r) => r.storage_path));
  const docs = visible.map((r) => toView(r, urls.get(r.storage_path) ?? null));
  return { tier, canManage: isPrime, docs };
}

// ── アップロード署名URL（元請のみ・許可リスト＋サイズ検証） ──
export interface UploadUrlResult {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
}
export async function createProjectDocUploadUrl(projectId: string, filename: string, size: number): Promise<UploadUrlResult> {
  const v = validateUpload(filename, size);
  if (!v.ok) return { ok: false, error: v.error };
  const guard = await requirePrime(projectId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const ext = v.ext ? "." + v.ext : "";
  const path = `${projectId}/${crypto.randomUUID()}${ext}`;
  const { data, error } = await guard.admin.storage.from(PROJECT_DOCS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `アップロードURLの発行に失敗しました: ${error?.message ?? ""}` };
  return { ok: true, path: data.path, token: data.token };
}

export interface AddDocInput {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileHash: string | null;
  documentType: string;
  visibility: DocVisibility;
  description: string;
  /** 差し替え時：この資料を論理削除してから追加する。 */
  replacesId?: string;
}

/** 案件資料を追加（元請のみ）。差し替え時は旧資料を論理削除し監査に replace を残す（上書きしない）。 */
export async function addProjectDocument(projectId: string, input: AddDocInput): Promise<DocsResult> {
  const v = validateUpload(input.fileName, input.fileSize);
  if (!v.ok) return { ok: false, error: v.error };
  const guard = await requirePrime(projectId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { admin, me } = guard;

  const { data: maxRow } = await admin.from("project_documents").select("sort_order").eq("project_id", projectId).is("deleted_at", null).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextSort = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await admin
    .from("project_documents")
    .insert({
      project_id: projectId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      file_hash: input.fileHash,
      document_type: input.documentType,
      visibility: input.visibility,
      description: input.description,
      sort_order: nextSort,
      uploaded_by: me,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) return { ok: false, error: `資料の追加に失敗しました: ${error?.message ?? ""}` };
  const newId = (inserted as { id: string }).id;

  if (input.replacesId) {
    await admin.from("project_documents").update({ deleted_at: new Date().toISOString() }).eq("id", input.replacesId).eq("project_id", projectId);
    await audit(admin, "replace", projectId, newId, { oldDocumentId: input.replacesId, newDocumentId: newId, fileName: input.fileName });
  } else {
    await audit(admin, "add", projectId, newId, { fileName: input.fileName, visibility: input.visibility, documentType: input.documentType, fileHash: input.fileHash });
  }
  return { ok: true };
}

async function requirePrimeForDoc(documentId: string): Promise<{ ok: true; admin: SupabaseClient; row: DocRow } | { ok: false; error: string }> {
  const admin = adminOrNull();
  if (!admin) return { ok: false, error: "資料機能が未設定です" };
  const { data } = await admin.from("project_documents").select("*").eq("id", documentId).maybeSingle();
  if (!data) return { ok: false, error: "資料が見つかりません" };
  const row = data as DocRow;
  const guard = await requirePrime(row.project_id);
  if (!guard.ok) return { ok: false, error: guard.error };
  return { ok: true, admin, row };
}

/** 論理削除（元請のみ）。実体（Storage）は消さない＝成立済み取引の証拠を保全する。 */
export async function deleteProjectDocument(documentId: string): Promise<DocsResult> {
  const guard = await requirePrimeForDoc(documentId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { admin, row } = guard;
  if (row.deleted_at) return { ok: true };
  await admin.from("project_documents").update({ deleted_at: new Date().toISOString() }).eq("id", documentId);
  await audit(admin, "delete", row.project_id, documentId, { fileName: row.file_name, storagePath: row.storage_path });
  return { ok: true };
}

/** 公開範囲の変更（元請のみ）。狭めても「以前は閲覧可能だった」履歴は監査に残る。 */
export async function changeDocVisibility(documentId: string, to: DocVisibility): Promise<DocsResult> {
  const guard = await requirePrimeForDoc(documentId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { admin, row } = guard;
  if (row.visibility === to) return { ok: true };
  await admin.from("project_documents").update({ visibility: to }).eq("id", documentId);
  await audit(admin, "visibility_change", row.project_id, documentId, { from: row.visibility, to });
  return { ok: true };
}

export async function updateDocMeta(documentId: string, patch: { fileName?: string; documentType?: string; description?: string }): Promise<DocsResult> {
  const guard = await requirePrimeForDoc(documentId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { admin, row } = guard;
  const update: Record<string, unknown> = {};
  if (patch.fileName != null && patch.fileName !== row.file_name) update.file_name = patch.fileName;
  if (patch.documentType != null && patch.documentType !== row.document_type) update.document_type = patch.documentType;
  if (patch.description != null && patch.description !== row.description) update.description = patch.description;
  if (Object.keys(update).length === 0) return { ok: true };
  await admin.from("project_documents").update(update).eq("id", documentId);
  if (update.document_type !== undefined) await audit(admin, "type_change", row.project_id, documentId, { from: row.document_type, to: update.document_type });
  if (update.description !== undefined) await audit(admin, "description_change", row.project_id, documentId, { fileName: row.file_name });
  return { ok: true };
}

/** 並び替え（元請のみ）。隣と sort_order を入れ替える。 */
export async function reorderDoc(documentId: string, dir: "up" | "down"): Promise<DocsResult> {
  const guard = await requirePrimeForDoc(documentId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { admin, row } = guard;
  const { data } = await admin.from("project_documents").select("id, sort_order").eq("project_id", row.project_id).is("deleted_at", null).order("sort_order", { ascending: true });
  const list = (data ?? []) as { id: string; sort_order: number }[];
  const idx = list.findIndex((d) => d.id === documentId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return { ok: true };
  const a = list[idx];
  const b = list[swapIdx];
  await admin.from("project_documents").update({ sort_order: b.sort_order }).eq("id", a.id);
  await admin.from("project_documents").update({ sort_order: a.sort_order }).eq("id", b.id);
  await audit(admin, "reorder", row.project_id, documentId, { dir });
  return { ok: true };
}

/**
 * 取引成立時の資料スナップショット。選定会社が閲覧可能だった資料を証拠として固定保存する。
 * 案件側の資料が後から削除・変更されても、成立時点の情報が消えないようにする。
 */
export async function snapshotForTransaction(projectId: string, transactionId: string, matchedAt: string): Promise<void> {
  const admin = adminOrNull();
  if (!admin) return;
  const { data } = await admin.from("project_documents").select("*").eq("project_id", projectId).is("deleted_at", null);
  const rows = (data ?? []) as DocRow[];
  if (rows.length === 0) return;
  const snapshots = rows.map((r) => ({
    transaction_id: transactionId,
    original_document_id: r.id,
    file_name: r.file_name,
    document_type: r.document_type,
    visibility: r.visibility,
    description: r.description,
    file_size: r.file_size,
    mime_type: r.mime_type,
    storage_path: r.storage_path,
    file_hash: r.file_hash,
    doc_created_at: r.created_at,
    matched_at: matchedAt,
    // 選定会社は全公開範囲を閲覧可能なので、成立時点で全資料が閲覧可能だった事実を記録。
    was_visible: canViewDocument(r.visibility, "selected"),
  }));
  await admin.from("transaction_document_snapshots").upsert(snapshots, { onConflict: "transaction_id,original_document_id", ignoreDuplicates: true });
}

// ── 取引詳細：成立時点の資料＋成立後に追加された資料 ──
export type TxDocStatus = "current" | "deleted";
/** before=成立前からの資料（スナップショット）、after=成立後に追加、migrated=既存取引で成立時点未確認。 */
export type TxDocOrigin = "before" | "after" | "migrated";
export interface TxDocView {
  fileName: string;
  documentTypeLabel: string;
  visibility: DocVisibility;
  description: string;
  fileSize: number;
  url: string | null;
  isImage: boolean;
  previewable: boolean;
  isPdf: boolean;
  isHeic: boolean;
  origin: TxDocOrigin;
  status: TxDocStatus;
}

function rowToTxDoc(r: DocRow, url: string | null, origin: TxDocOrigin, status: TxDocStatus): TxDocView {
  return {
    fileName: r.file_name,
    documentTypeLabel: DOCUMENT_TYPE_LABEL[r.document_type] ?? r.document_type,
    visibility: r.visibility,
    description: r.description,
    fileSize: r.file_size,
    url,
    isImage: isImage(r.file_name), previewable: isPreviewableImage(r.file_name), isPdf: isPdf(r.file_name), isHeic: isHeic(r.file_name),
    origin,
    status,
  };
}

/**
 * 取引詳細の案件資料。
 * - スナップショットがある取引：成立前からの資料（削除済みでも証拠として参照可）＋成立後に追加された資料。
 * - スナップショットが無い既存取引（legacy）：現在共有中の資料を「成立時点の共有状況は未確認」として表示。
 *   ※既存取引の資料を「成立前からの資料」と誤認させないため、before/after には振り分けない。
 * 取引当事者（元請/協力）のみ。旧 Transaction state 形式でも tx 行の列だけを読むため落ちない。
 */
export async function loadTransactionDocuments(transactionId: string, viewerCompanyId: string | null): Promise<{ ok: boolean; legacy: boolean; docs: TxDocView[] }> {
  const admin = adminOrNull();
  if (!admin || !viewerCompanyId) return { ok: false, legacy: false, docs: [] };
  const { data: txRow } = await admin.from("transactions").select("project_id, prime_id, partner_id, created_at").eq("id", transactionId).maybeSingle();
  if (!txRow) return { ok: false, legacy: false, docs: [] };
  const tx = txRow as { project_id: string | null; prime_id: string; partner_id: string; created_at: string };
  const isPrime = viewerCompanyId === tx.prime_id;
  const isPartner = viewerCompanyId === tx.partner_id;
  if (!isPrime && !isPartner) return { ok: false, legacy: false, docs: [] }; // 取引当事者のみ
  const tier: ViewerTier = isPrime ? "prime" : "selected";

  const { data: snapRows } = await admin.from("transaction_document_snapshots").select("*").eq("transaction_id", transactionId);
  const snaps = (snapRows ?? []) as {
    original_document_id: string | null; file_name: string; document_type: string; visibility: DocVisibility;
    description: string; file_size: number; storage_path: string;
  }[];

  // 現在の案件資料（削除済み含む）。
  const currentRows: DocRow[] = [];
  const currentById = new Map<string, DocRow>();
  if (tx.project_id) {
    const { data: curRows } = await admin.from("project_documents").select("*").eq("project_id", tx.project_id);
    for (const r of (curRows ?? []) as DocRow[]) { currentRows.push(r); currentById.set(r.id, r); }
  }

  const legacy = snaps.length === 0;
  let docs: TxDocView[];

  if (legacy) {
    // 既存取引：現在公開中の閲覧可能な資料を「成立時点未確認」として表示（before/after に分けない）。
    const visible = currentRows.filter((r) => r.deleted_at == null && canViewDocument(r.visibility, tier));
    const urls = await signedMap(admin, visible.map((r) => r.storage_path));
    docs = visible.map((r) => rowToTxDoc(r, urls.get(r.storage_path) ?? null, "migrated", "current"));
  } else {
    const snapIds = new Set(snaps.map((s) => s.original_document_id));
    const afterRows = currentRows.filter((r) => !snapIds.has(r.id) && r.deleted_at == null && r.created_at > tx.created_at && canViewDocument(r.visibility, tier));
    const urls = await signedMap(admin, [...snaps.map((s) => s.storage_path), ...afterRows.map((r) => r.storage_path)]);
    const before: TxDocView[] = snaps.map((s) => {
      const cur = s.original_document_id ? currentById.get(s.original_document_id) : undefined;
      const status: TxDocStatus = cur && cur.deleted_at == null ? "current" : "deleted";
      return {
        fileName: s.file_name,
        documentTypeLabel: DOCUMENT_TYPE_LABEL[s.document_type] ?? s.document_type,
        visibility: s.visibility, description: s.description, fileSize: s.file_size,
        url: urls.get(s.storage_path) ?? null,
        isImage: isImage(s.file_name), previewable: isPreviewableImage(s.file_name), isPdf: isPdf(s.file_name), isHeic: isHeic(s.file_name),
        origin: "before", status,
      };
    });
    const after = afterRows.map((r) => rowToTxDoc(r, urls.get(r.storage_path) ?? null, "after", "current"));
    docs = [...before, ...after];
  }

  // 証拠トレイル：成立済み取引の資料URL発行を監査に残す（当事者による参照の記録）。
  if (docs.length > 0 && tx.project_id) {
    await audit(admin, "url_issued", tx.project_id, null, { transactionId, count: docs.length, viewer: viewerCompanyId, legacy });
  }
  return { ok: true, legacy, docs };
}

export { MAX_DOC_BYTES };
