import { createClient } from "../lib/supabase/server";
import { rowToCompany, rowToProject, type CompanyRow, type ProjectRow } from "../infra/supabase/mappers";
import { companyCreditLevel, type Company } from "../domain/company";
import type { Project } from "../domain/project";
import type { ProjectFilter } from "../domain/projectSearch";

export interface ProjectCardView {
  id: string;
  name: string;
  jobType: string;
  payType: string;
  region: string;
  unitPrice: number;
  need: number | null;
  assemblyStart: string | null;
  dismantleStart: string | null;
  guaranteed: boolean;
  stage: string;
  applicants: number;
  primeName: string;
  primeLevel: string;
  isOwn: boolean;
  /** 閲覧者自身がこの案件に応募済みか（自分の応募状態のみ。他社の応募は含めない）。 */
  applied: boolean;
}

function toCard(p: Project, primeById: Map<string, Company>, myCompanyId: string | null): ProjectCardView {
  const prime = primeById.get(p.primeId);
  return {
    id: p.id,
    name: p.name,
    jobType: p.jobType,
    payType: p.payType,
    region: p.region,
    unitPrice: p.unitPrice,
    need: p.need,
    assemblyStart: p.assemblySchedule.plannedStart,
    dismantleStart: p.dismantleSchedule.plannedStart,
    guaranteed: p.guaranteed,
    stage: p.stage,
    applicants: p.applicantIds.length,
    primeName: prime?.name ?? p.primeId,
    primeLevel: prime ? companyCreditLevel(prime, false) : "unverified",
    isOwn: p.primeId === myCompanyId,
    applied: myCompanyId != null && p.applicantIds.some((a) => (a as unknown as string) === myCompanyId),
  };
}

export interface ProjectSearchResult {
  cards: ProjectCardView[];
  total: number;
}

/**
 * 条件で案件を検索する。絞り込みは Supabase 側の列（prefecture/city/job_type/
 * starts_on/ends_on/unit_price/need/guaranteed/has_assembly/has_dismantle 等）で行い、
 * 全件取得後のクライアント絞り込みには依存しない。
 * カードは自分の応募状態のみ露出し、他社の応募情報は返さない（第三者秘匿）。
 */
export async function searchProjects(filter: ProjectFilter, myCompanyId: string | null): Promise<ProjectSearchResult> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // 本部承認済み（status=active）の元請ID。primeApproved フィルタで prime_id を DB 側で絞る。
  let approvedIds: string[] | null = null;
  if (filter.primeApproved) {
    const { data } = await supabase.from("companies").select("id").eq("status", "active");
    approvedIds = (data ?? []).map((r) => (r as { id: string }).id);
    if (approvedIds.length === 0) return { cards: [], total: 0 };
  }

  let q = supabase.from("projects").select("state", { count: "exact" });
  // 検索一覧は「他社の案件」。自社が投稿した案件は専用の一覧にまとめるため除外する。
  if (myCompanyId) q = q.neq("prime_id", myCompanyId);
  if (filter.recruitingOnly) q = q.eq("stage", "recruiting");
  if (!filter.includeEnded) q = q.gte("deadline", today);
  if (filter.jobType) q = q.eq("job_type", filter.jobType);
  if (filter.prefecture) q = q.eq("prefecture", filter.prefecture);
  if (filter.city) q = q.ilike("city", `%${filter.city}%`);
  if (filter.phase === "assembly") q = q.eq("has_assembly", true).eq("has_dismantle", false);
  if (filter.phase === "dismantle") q = q.eq("has_assembly", false).eq("has_dismantle", true);
  if (filter.phase === "both") q = q.eq("has_assembly", true).eq("has_dismantle", true);
  if (filter.periodStart) q = q.gte("ends_on", filter.periodStart);
  if (filter.periodEnd) q = q.lte("starts_on", filter.periodEnd);
  if (filter.amountMin != null) q = q.gte("unit_price", filter.amountMin);
  if (filter.amountMax != null) q = q.lte("unit_price", filter.amountMax);
  if (filter.need === "1") q = q.eq("need", 1);
  if (filter.need === "2") q = q.eq("need", 2);
  if (filter.need === "3plus") q = q.gte("need", 3);
  if (filter.guaranteed) q = q.eq("guaranteed", true);
  if (approvedIds) q = q.in("prime_id", approvedIds);

  if (filter.sort === "amountDesc") q = q.order("unit_price", { ascending: false });
  else if (filter.sort === "startSoon") q = q.order("starts_on", { ascending: true, nullsFirst: false });
  else q = q.order("posted", { ascending: false }).order("created_at", { ascending: false });

  const { data: projectRows, count } = await q;
  const projects = (projectRows ?? []).map((r) => rowToProject(r as unknown as ProjectRow));

  const { data: companyRows } = await supabase.from("companies").select("*");
  const primeById = new Map((companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow)).map((c) => [c.id, c]));
  const cards = projects.map((p) => toCard(p, primeById, myCompanyId));
  return { cards, total: count ?? cards.length };
}

/**
 * 自社が投稿した案件（募集中＋一時停止中）。案件タブに専用の一覧としてまとめる。
 * 選定済み(matched)は取引タブへ、削除(closed)は非表示。募集中を先に、次に停止中を並べる。
 */
export async function listOwnActiveProjects(companyId: string | null): Promise<ProjectCardView[]> {
  if (!companyId) return [];
  const supabase = await createClient();
  const [{ data: projectRows }, { data: companyRows }] = await Promise.all([
    supabase.from("projects").select("state").eq("prime_id", companyId).in("stage", ["recruiting", "paused"]).order("created_at", { ascending: false }),
    supabase.from("companies").select("*"),
  ]);
  const projects = (projectRows ?? []).map((r) => rowToProject(r as unknown as ProjectRow));
  const primeById = new Map((companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow)).map((c) => [c.id, c]));
  const cards = projects.map((p) => toCard(p, primeById, companyId));
  // 募集中→停止中の順に並べる。
  return cards.sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "recruiting" ? -1 : 1));
}

export async function listProjects(myCompanyId: string | null): Promise<ProjectCardView[]> {
  const supabase = await createClient();
  const [{ data: projectRows }, { data: companyRows }] = await Promise.all([
    supabase.from("projects").select("state").order("created_at", { ascending: false }),
    supabase.from("companies").select("*"),
  ]);
  const projects = (projectRows ?? []).map((r) => rowToProject(r as unknown as ProjectRow));
  const primeById = new Map((companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow)).map((c) => [c.id, c]));
  return projects.map((p) => toCard(p, primeById, myCompanyId));
}

export async function loadProjectDetail(id: string): Promise<{ project: Project; prime: Company | null; applicants: Company[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("state").eq("id", id).maybeSingle();
  if (!data) return null;
  const project = rowToProject(data as unknown as ProjectRow);
  const { data: companyRows } = await supabase.from("companies").select("*");
  const byId = new Map((companyRows ?? []).map((r) => rowToCompany(r as unknown as CompanyRow)).map((c) => [c.id, c]));
  const prime = byId.get(project.primeId) ?? null;
  const applicants = project.applicantIds.map((aid) => byId.get(aid)).filter((c): c is Company => Boolean(c));
  return { project, prime, applicants };
}
