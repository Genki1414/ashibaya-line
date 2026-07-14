import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadCompanyPageData } from "@/server/companyData";
import { loadProjectDetail } from "@/server/projectData";
import { currentCompanyId } from "@/server/acting";
import { projectToFormDefaults, withClearedDates } from "@/lib/projectFormDefaults";
import type { JobFormState } from "../JobForm";
import { JobForm } from "../JobForm";
import { postProjectAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件を投稿" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { self } = await loadCompanyPageData();
  if (self && self.status !== "active") redirect("/projects");

  // ?from=<projectId> が指定されたら、その案件を複製して初期値に流し込む（再投稿）。
  // 複製できるのは自社（元請本人）が投稿した案件のみ。日程は新規に入力させる。
  const { from } = await searchParams;
  let defaults: Partial<JobFormState> | undefined;
  let copied = false;
  if (from) {
    const detail = await loadProjectDetail(from);
    const myCompanyId = await currentCompanyId();
    const isOwner = detail != null && myCompanyId != null && myCompanyId === (detail.project.primeId as unknown as string);
    if (isOwner) {
      defaults = withClearedDates(projectToFormDefaults(detail!.project));
      copied = true;
    }
  }

  return (
    <AppShell title={copied ? "案件を再投稿" : "案件を投稿"} back="/projects">
      {copied && (
        <div className="mb-3 rounded-xl border border-(--color-brand-blue-light) bg-(--color-brand-blue-soft) p-3 text-[12.5px] leading-relaxed text-(--color-brand-sub)">
          過去の案件を複製しました。<span className="font-bold text-(--color-brand-ink)">工期・組立/解体・募集締切の日付は新しく入力してください。</span>その他の内容は必要に応じて修正できます。
        </div>
      )}
      <JobForm mode="create" action={postProjectAction} defaults={defaults} />
    </AppShell>
  );
}
