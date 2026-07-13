"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/server/container";
import { canTransact } from "@/domain/company";
import type { ClosingDay, JobType, PayTerm, PayType } from "@/domain/transaction";

export interface ProjectActionResult {
  readonly ok: boolean;
  readonly error?: string;
}

function s(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

/** 案件投稿（発注）。本部承認済み（active）会社のみ。 */
export async function postProjectAction(_prev: ProjectActionResult | null, fd: FormData): Promise<ProjectActionResult> {
  const container = await getContainer();
  const company = await container.loadCompany(container.actingCompanyId as unknown as string);
  if (!company) return { ok: false, error: "会社情報が取得できませんでした" };
  if (!canTransact(company)) return { ok: false, error: "案件の投稿は本部の承認後に可能になります" };

  const name = s(fd, "name");
  const start = s(fd, "start");
  const end = s(fd, "end");
  const priceRaw = s(fd, "unitPrice");
  if (!name) return { ok: false, error: "案件名を入力してください" };
  if (!start || !end) return { ok: false, error: "工期（開始・終了）を入力してください" };
  if (!priceRaw) return { ok: false, error: "金額を入力してください" };

  const assemblyStart = s(fd, "assemblyStart") || start;
  const dismantleStart = s(fd, "dismantleStart") || end;
  const needRaw = s(fd, "need");

  const result = await container.projectService.post(container.actingCompanyId, {
    name,
    jobType: (s(fd, "jobType") || "support") as JobType,
    region: s(fd, "region"),
    address: s(fd, "address") || "（後日連絡）",
    overallSchedule: { plannedStart: start, plannedEnd: end },
    assemblySchedule: { plannedStart: assemblyStart, plannedEnd: s(fd, "assemblyEnd") || assemblyStart },
    dismantleSchedule: { plannedStart: dismantleStart, plannedEnd: s(fd, "dismantleEnd") || dismantleStart },
    need: needRaw ? Number(needRaw) : null,
    unitPrice: Number(priceRaw),
    payType: (s(fd, "payType") || "progress") as PayType,
    closing: (s(fd, "closing") || "末") as ClosingDay,
    payTerm: (s(fd, "payTerm") || "翌月末") as PayTerm,
    workDescription: s(fd, "work") || "詳細はチャットにて。",
    belongings: s(fd, "belongings"),
    applicationDeadline: s(fd, "deadline") || start,
    guaranteed: s(fd, "guaranteed") === "on",
  });

  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath("/projects");
  redirect("/projects");
}
