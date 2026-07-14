import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { LevelBadge } from "@/components/company/parts";
import { Notifications } from "@/components/app/Notifications";
import { loadCompanyPageData } from "@/server/companyData";
import { searchProjects, listOwnActiveProjects, type ProjectCardView } from "@/server/projectData";
import { loadUnreadChats } from "@/server/chatData";
import { parseProjectFilter } from "@/domain/projectSearch";
import { ProjectsFilterBar } from "./ProjectsFilterBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件" };

const d2 = (s: string | null) => (s ? `${Number(s.split("-")[1])}/${Number(s.split("-")[2])}` : "-");
const yen = (n: number) => "¥" + Number(n).toLocaleString();

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color, background: bg }}>{label}</span>;
}

function ProjectCard({ p, unread }: { p: ProjectCardView; unread: number }) {
  return (
    <Link href={`/projects/${p.id}`} className="mb-3 block rounded-2xl border border-(--color-brand-line) bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {p.stage === "paused"
          ? <Pill label="停止中" color="#9A6612" bg="#FCF2DF" />
          : <Pill label={p.stage === "recruiting" ? "募集中" : "選定済み"} color="#1657C9" bg="#E8F0FE" />}
        <Pill label={p.jobType === "contract" ? "請負" : "応援"} color={p.jobType === "contract" ? "#6D4AC4" : "#1657C9"} bg={p.jobType === "contract" ? "#EEE9FA" : "#E8F0FE"} />
        <Pill label={p.payType === "progress" ? "出来高" : "一括"} color={p.payType === "progress" ? "#C79A2E" : "#5B6473"} bg={p.payType === "progress" ? "#FBF2D9" : "#EEF1F5"} />
        {p.isOwn && <Pill label="自社の案件" color="#159B67" bg="#E4F6EE" />}
        {p.applied && p.stage === "recruiting" && <Pill label="応募中" color="#C77700" bg="#FCF2DF" />}
        {unread > 0 && <Pill label={`💬 新着${unread}`} color="#6D4AC4" bg="#EEE9FA" />}
        <span className="ml-auto"><LevelBadge level={p.primeLevel} /></span>
      </div>
      <div className="text-[15.5px] font-bold text-(--color-brand-ink)">{p.name}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12.5px] text-(--color-brand-sub)">
        <span>📍 {p.region || "未設定"}</span>
        <span>🗓 組立{d2(p.assemblyStart)}・解体{d2(p.dismantleStart)}</span>
        {p.need ? <span>👷 {p.need}名</span> : null}
        <span>元請 {p.primeName}{p.isOwn ? "（自社）" : ""}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-(--color-brand-line) pt-2.5">
        <div>
          <span className="text-[19px] font-black text-(--color-brand-blue)">{yen(p.unitPrice)}</span>
          <span className="ml-1 text-[11.5px] text-(--color-brand-sub)">{p.jobType === "contract" ? "請負金額" : "日額/人工"}</span>
        </div>
        <span className="text-[13px] font-bold text-(--color-brand-blue)">詳細 ›</span>
      </div>
    </Link>
  );
}

export default async function ProjectsTab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseProjectFilter(await searchParams);
  const { self, companyId } = await loadCompanyPageData();
  const [{ cards: projects, total }, unreadChats, ownProjects] = await Promise.all([searchProjects(filter, companyId), loadUnreadChats(), listOwnActiveProjects(companyId)]);
  const unreadByProject = new Map<string, number>();
  for (const c of unreadChats) unreadByProject.set(c.projectId, (unreadByProject.get(c.projectId) ?? 0) + c.count);
  const canPost = self?.status === "active";

  return (
    <AppShell title="案件">
      {companyId && <Notifications emptyHint={false} />}
      {canPost ? (
        <Link href="/projects/new" className="mb-4 block rounded-2xl border-[1.5px] border-dashed border-(--color-brand-blue) bg-(--color-brand-blue-soft) py-3.5 text-center text-[14.5px] font-bold text-(--color-brand-blue)">
          ＋ 案件を投稿する
        </Link>
      ) : (
        <div className="mb-4 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3 text-[12.5px] text-(--color-brand-sub)">
          案件の投稿（発注）は本部の承認後に可能になります。
        </div>
      )}
      {ownProjects.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12.5px] font-bold text-(--color-brand-ink)">自社が投稿した案件（{ownProjects.length}）</div>
          {ownProjects.map((p) => <ProjectCard key={p.id} p={p} unread={unreadByProject.get(p.id) ?? 0} />)}
        </div>
      )}
      <div className="mb-1.5 text-[12.5px] font-bold text-(--color-brand-ink)">募集中の案件（応募できる案件）</div>
      <ProjectsFilterBar filter={filter} total={total} />
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-6 text-center text-[13px] text-(--color-brand-sub)">
          条件に合う募集中の案件はありません。<br />絞り込み条件を変えてお試しください。
        </div>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} p={p} unread={unreadByProject.get(p.id) ?? 0} />)
      )}
    </AppShell>
  );
}
