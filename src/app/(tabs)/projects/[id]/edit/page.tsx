import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { JobForm, type JobFormState } from "../../JobForm";
import { updateProjectAction } from "../../actions";
import { loadProjectDetail } from "@/server/projectData";
import { currentCompanyId } from "@/server/acting";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件を編集" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadProjectDetail(id);
  if (!detail) notFound();
  const { project } = detail;

  const myCompanyId = await currentCompanyId();
  const isPrime = myCompanyId != null && myCompanyId === (project.primeId as unknown as string);
  // 元請本人・募集中のみ編集可。それ以外は詳細へ戻す。
  if (!isPrime || project.stage !== "recruiting") redirect(`/projects/${id}`);

  const defaults: Partial<JobFormState> = {
    name: project.name,
    jobType: project.jobType,
    prefecture: project.prefecture,
    city: project.city,
    address: project.address,
    start: project.overallSchedule.plannedStart ?? "",
    end: project.overallSchedule.plannedEnd ?? "",
    assemblyStart: project.assemblySchedule.plannedStart ?? "",
    assemblyEnd: project.assemblySchedule.plannedEnd ?? "",
    dismantleStart: project.dismantleSchedule.plannedStart ?? "",
    dismantleEnd: project.dismantleSchedule.plannedEnd ?? "",
    need: project.need != null ? String(project.need) : "",
    price: String(project.unitPrice),
    payType: project.payType,
    closing: project.closing,
    payTerm: project.payTerm,
    work: project.workDescription,
    belongings: project.belongings,
    deadline: project.applicationDeadline,
  };

  return (
    <AppShell title="案件を編集" back={`/projects/${id}`}>
      <a href={`/projects/${id}/documents`} className="mb-3 flex items-center justify-center gap-1.5 rounded-xl border border-(--color-brand-blue) bg-(--color-brand-blue-soft) py-2.5 text-[13.5px] font-bold text-(--color-brand-blue)">
        📎 案件資料を管理する
      </a>
      <JobForm mode="edit" action={updateProjectAction} projectId={id} defaults={defaults} />
    </AppShell>
  );
}
