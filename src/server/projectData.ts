import { createClient } from "../lib/supabase/server";
import { rowToCompany, rowToProject, type CompanyRow, type ProjectRow } from "../infra/supabase/mappers";
import { companyCreditLevel, type Company } from "../domain/company";
import type { Project } from "../domain/project";

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
  };
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
