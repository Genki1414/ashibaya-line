"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/server/container";
import { createAdminClient } from "@/lib/supabase/admin";
import { canTransact } from "@/domain/company";
import { applyToProject, withdrawApplication, pauseProject, resumeProject, closeProject, grantDisclosure, revokeDisclosure } from "@/domain/project";
import { CompanyId, ProjectId } from "@/domain/shared";
import { projectToRow, rowToProject, type ProjectRow } from "@/infra/supabase/mappers";
import type { ClosingDay, JobType, PayTerm, PayType } from "@/domain/transaction";
import { sendPushToCompany } from "@/server/push";

export interface ProjectActionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly transactionId?: string;
}

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

/** 案件フォーム（投稿/編集共通）の FormData → コマンド変換。バリデーションエラー時は error を返す。 */
function parseProjectForm(fd: FormData):
  | { ok: true; command: Parameters<Awaited<ReturnType<typeof getContainer>>["projectService"]["post"]>[1] }
  | { ok: false; error: string } {
  const name = s(fd, "name");
  const start = s(fd, "start");
  const end = s(fd, "end");
  const priceRaw = s(fd, "unitPrice");
  const prefecture = s(fd, "prefecture");
  const city = s(fd, "city");
  if (!name) return { ok: false, error: "案件名を入力してください" };
  if (!prefecture) return { ok: false, error: "都道府県を選択してください" };
  if (!start || !end) return { ok: false, error: "工期（開始・終了）を入力してください" };
  if (!priceRaw) return { ok: false, error: "金額を入力してください" };

  const assemblyStart = s(fd, "assemblyStart") || start;
  const dismantleStart = s(fd, "dismantleStart") || end;
  const needRaw = s(fd, "need");

  return {
    ok: true,
    command: {
      name,
      jobType: (s(fd, "jobType") || "support") as JobType,
      prefecture,
      city,
      address: s(fd, "address") || "（後日連絡）",
      overallSchedule: { plannedStart: start, plannedEnd: end },
      assemblySchedule: { plannedStart: assemblyStart, plannedEnd: s(fd, "assemblyEnd") || assemblyStart },
      dismantleSchedule: { plannedStart: dismantleStart, plannedEnd: s(fd, "dismantleEnd") || dismantleStart },
      need: needRaw ? Number(needRaw.replace(/[^\d]/g, "")) : null,
      unitPrice: Number(priceRaw.replace(/[^\d]/g, "")),
      payType: (s(fd, "payType") || "progress") as PayType,
      closing: (s(fd, "closing") || "末") as ClosingDay,
      payTerm: (s(fd, "payTerm") || "翌月末") as PayTerm,
      workDescription: s(fd, "work") || "詳細はチャットにて。",
      belongings: s(fd, "belongings"),
      applicationDeadline: s(fd, "deadline") || start,
      // 売掛保証は受注側が受注時に選択するため、案件（発注側）では常に未適用で作成する。
      guaranteed: false,
    },
  };
}

/** 案件投稿（発注）。本部承認済み（active）会社のみ。 */
export async function postProjectAction(_prev: ProjectActionResult | null, fd: FormData): Promise<ProjectActionResult> {
  const container = await getContainer();
  const company = await container.loadCompany(container.actingCompanyId as unknown as string);
  if (!company) return { ok: false, error: "会社情報が取得できませんでした" };
  if (!canTransact(company)) return { ok: false, error: "案件の投稿は本部の承認後に可能になります" };

  const parsed = parseProjectForm(fd);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const result = await container.projectService.post(container.actingCompanyId, parsed.command);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath("/projects");
  redirect("/projects");
}

/** 案件編集（元請のみ・募集中のみ）。 */
export async function updateProjectAction(_prev: ProjectActionResult | null, fd: FormData): Promise<ProjectActionResult> {
  const container = await getContainer();
  const projectId = s(fd, "id");
  if (!projectId) return { ok: false, error: "案件IDが不正です" };
  const company = await container.loadCompany(container.actingCompanyId as unknown as string);
  if (!company) return { ok: false, error: "会社情報が取得できませんでした" };
  if (!canTransact(company)) return { ok: false, error: "案件の編集は本部の承認後に可能になります" };

  const parsed = parseProjectForm(fd);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const result = await container.projectService.edit(container.actingCompanyId, ProjectId(projectId), parsed.command);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

/** 応募（受注）。応募者は元請ではないため、案件への応募者追加は service_role で行う（RLSは厳格なまま）。 */
export async function applyAction(projectId: string): Promise<ProjectActionResult> {
  const container = await getContainer();
  const companyId = container.actingCompanyId;
  const company = await container.loadCompany(companyId);
  if (!company) return { ok: false, error: "会社情報が取得できませんでした" };
  if (!canTransact(company)) return { ok: false, error: "応募（受注）は本部の承認後に可能になります" };

  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("state").eq("id", projectId).maybeSingle();
  if (!data) return { ok: false, error: "案件が見つかりません" };
  const project = rowToProject(data as unknown as ProjectRow);
  const applied = applyToProject(project, CompanyId(companyId));
  if (!applied.ok) return { ok: false, error: applied.error.message };

  const { error } = await admin.from("projects").update({ ...projectToRow(applied.value), updated_at: new Date().toISOString() }).eq("id", projectId);
  if (error) return { ok: false, error: `応募に失敗しました: ${error.message}` };
  // 元請へプッシュ通知（未設定・購読なしなら静かに無視）。
  await sendPushToCompany(project.primeId as unknown as string, {
    title: "新しい応募", body: `「${project.name}」に応募がありました`, url: `/projects/${projectId}`, tag: `apply-${projectId}`,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}

/** 応募の取り消し（応募会社本人）。応募者判定は domain 側で行い、第三者は取り消せない。
 *  応募者は元請でないため、案件の応募者更新は service_role で行う（RLS は厳格なまま）。 */
export async function withdrawApplicationAction(projectId: string): Promise<ProjectActionResult> {
  const container = await getContainer();
  const companyId = container.actingCompanyId;
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("state").eq("id", projectId).maybeSingle();
  if (!data) return { ok: false, error: "案件が見つかりません" };
  const project = rowToProject(data as unknown as ProjectRow);
  const res = withdrawApplication(project, CompanyId(companyId));
  if (!res.ok) return { ok: false, error: res.error.message };
  const { error } = await admin.from("projects").update({ ...projectToRow(res.value), updated_at: new Date().toISOString() }).eq("id", projectId);
  if (error) return { ok: false, error: `応募の取り消しに失敗しました: ${error.message}` };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}

/** 掲載の一時停止／再開／削除（元請本人のみ）。削除は選定済み（取引中）には不可。
 *  案件の書き込みは service_role で行う（元請本人であることをここで検証済み。RLS由来の失敗を避ける）。 */
export async function setListingStateAction(projectId: string, op: "pause" | "resume" | "close"): Promise<ProjectActionResult> {
  try {
    const container = await getContainer();
    const me = container.actingCompanyId as unknown as string;
    const admin = createAdminClient();
    const { data } = await admin.from("projects").select("state").eq("id", projectId).maybeSingle();
    if (!data) return { ok: false, error: "案件が見つかりません" };
    const project = rowToProject(data as unknown as ProjectRow);
    if ((project.primeId as unknown as string) !== me) return { ok: false, error: "自社が投稿した案件のみ操作できます" };

    const res = op === "pause" ? pauseProject(project) : op === "resume" ? resumeProject(project) : closeProject(project);
    if (!res.ok) return { ok: false, error: res.error.message };

    const { error } = await admin.from("projects").update({ ...projectToRow(res.value), updated_at: new Date().toISOString() }).eq("id", projectId);
    if (error) {
      const detail = `${error.message} ${error.details ?? ""} ${error.code ?? ""}`;
      if (/stage/i.test(detail)) return { ok: false, error: "案件状態の更新に失敗しました。マイグレーション 0012（stage の制約更新）を適用してください。" };
      return { ok: false, error: `操作に失敗しました: ${error.message}` };
    }
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `操作に失敗しました: ${msg}` };
  }
}

/** 募集要項の閲覧許可を応募会社ごとに付与／取消（元請本人のみ）。書き込みは service_role。 */
export async function setDisclosureAction(projectId: string, partnerId: string, grant: boolean): Promise<ProjectActionResult> {
  try {
    const container = await getContainer();
    const me = container.actingCompanyId as unknown as string;
    const admin = createAdminClient();
    const { data } = await admin.from("projects").select("state").eq("id", projectId).maybeSingle();
    if (!data) return { ok: false, error: "案件が見つかりません" };
    const project = rowToProject(data as unknown as ProjectRow);
    if ((project.primeId as unknown as string) !== me) return { ok: false, error: "自社が投稿した案件のみ操作できます" };
    const res = grant ? grantDisclosure(project, CompanyId(partnerId)) : revokeDisclosure(project, CompanyId(partnerId));
    if (!res.ok) return { ok: false, error: res.error.message };
    const { error } = await admin.from("projects").update({ ...projectToRow(res.value), updated_at: new Date().toISOString() }).eq("id", projectId);
    if (error) return { ok: false, error: `操作に失敗しました: ${error.message}` };
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `操作に失敗しました: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 選定（この会社に依頼）。元請が応募者を選び、取引を生成する。 */
export async function selectPartnerAction(projectId: string, partnerId: string): Promise<ProjectActionResult> {
  const container = await getContainer();
  const company = await container.loadCompany(container.actingCompanyId);
  if (!company) return { ok: false, error: "会社情報が取得できませんでした" };
  if (!canTransact(company)) return { ok: false, error: "選定（発注）は本部の承認後に可能になります" };

  const result = await container.matching.selectPartner(container.actingCompanyId, ProjectId(projectId), CompanyId(partnerId));
  if (!result.ok) return { ok: false, error: result.error.message };

  // 取引成立時点で、選定会社が閲覧可能だった案件資料のスナップショットを保存（証拠保全）。
  // 案件側の資料が後から削除・変更されても、成立時点の情報が取引側に残る。失敗しても選定自体は成功。
  try {
    const { snapshotForTransaction } = await import("@/server/projectDocs");
    await snapshotForTransaction(projectId, result.data.id, new Date().toISOString().slice(0, 10));
  } catch {
    // Supabase未接続・service_role未設定などではスナップショットのみスキップ。
  }

  // 選定された協力会社へプッシュ通知。
  await sendPushToCompany(partnerId, {
    title: "選定されました", body: `「${result.data.projectName}」で選定されました。取引を開始してください`, url: `/transactions/${result.data.id}`, tag: `select-${result.data.id}`,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/transactions");
  return { ok: true, transactionId: result.data.id };
}
