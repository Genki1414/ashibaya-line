import type { Project } from "@/domain/project";
import type { JobFormState } from "@/app/(tabs)/projects/JobForm";

/**
 * ドメインの Project を投稿フォーム（JobForm）の初期値へ変換する純粋関数。
 * 案件の編集（そのまま復元）と再投稿（複製）の双方から使う。
 */
export function projectToFormDefaults(project: Project): Partial<JobFormState> {
  return {
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
}

/** 日付系の項目（工期・組立・解体・締切）を空にする。再投稿では新しい日程を必ず入力させる。 */
export function withClearedDates(defaults: Partial<JobFormState>): Partial<JobFormState> {
  return {
    ...defaults,
    start: "",
    end: "",
    assemblyStart: "",
    assemblyEnd: "",
    dismantleStart: "",
    dismantleEnd: "",
    deadline: "",
  };
}
