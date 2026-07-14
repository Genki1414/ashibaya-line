import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadProjectDetail } from "@/server/projectData";
import { loadProjectDocuments } from "@/server/projectDocs";
import { currentCompanyId } from "@/server/acting";
import { DocumentsManager } from "./DocumentsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件資料の管理" };

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const detail = await loadProjectDetail(id);
  if (!detail) notFound();

  const me = await currentCompanyId();
  const isPrime = me != null && me === (detail.project.primeId as unknown as string);
  if (!isPrime) redirect(`/projects/${id}`); // 資料の管理は元請のみ

  const { docs } = await loadProjectDocuments(id, me);
  // 取引画面などから来た場合は戻り先を維持（安全のため内部パスのみ許可）。
  const back = from && from.startsWith("/") ? from : `/projects/${id}`;

  return (
    <AppShell title="案件資料の管理" back={back}>
      <div className="mb-3 rounded-2xl border border-(--color-brand-blue-light) bg-(--color-brand-blue-soft) p-3 text-[12px] leading-relaxed text-(--color-brand-sub)">
        図面・写真・書類を案件に添付できます。公開範囲は「案件閲覧者／応募会社／選定会社」から選べます。
        取引成立時点で共有済みの資料は、あとで削除しても取引相手には証拠として残ります。
      </div>
      <DocumentsManager projectId={id} docs={docs} />
    </AppShell>
  );
}
