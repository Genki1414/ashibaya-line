import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { LevelBadge } from "@/components/company/parts";
import { loadCompanyPageData } from "@/server/companyData";
import { listProjects, type ProjectCardView } from "@/server/projectData";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件" };

const d2 = (s: string | null) => (s ? `${Number(s.split("-")[1])}/${Number(s.split("-")[2])}` : "-");
const yen = (n: number) => "¥" + Number(n).toLocaleString();

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color, background: bg }}>{label}</span>;
}

function ProjectCard({ p }: { p: ProjectCardView }) {
  return (
    <Link href={`/projects/${p.id}`} className="mb-3 block rounded-2xl border border-(--color-brand-line) bg-white p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Pill label={p.stage === "recruiting" ? "募集中" : "選定済み"} color="#1657C9" bg="#E8F0FE" />
        <Pill label={p.jobType === "contract" ? "請負" : "応援"} color={p.jobType === "contract" ? "#6D4AC4" : "#1657C9"} bg={p.jobType === "contract" ? "#EEE9FA" : "#E8F0FE"} />
        <Pill label={p.payType === "progress" ? "出来高" : "一括"} color={p.payType === "progress" ? "#C79A2E" : "#5B6473"} bg={p.payType === "progress" ? "#FBF2D9" : "#EEF1F5"} />
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

export default async function ProjectsTab() {
  const { self, companyId } = await loadCompanyPageData();
  const projects = await listProjects(companyId);
  const canPost = self?.status === "active";

  return (
    <AppShell title="案件">
      {canPost ? (
        <Link href="/projects/new" className="mb-4 block rounded-2xl border-[1.5px] border-dashed border-(--color-brand-blue) bg-(--color-brand-blue-soft) py-3.5 text-center text-[14.5px] font-bold text-(--color-brand-blue)">
          ＋ 案件を投稿する
        </Link>
      ) : (
        <div className="mb-4 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3 text-[12.5px] text-(--color-brand-sub)">
          案件の投稿（発注）は本部の承認後に可能になります。
        </div>
      )}
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-6 text-center text-[13px] text-(--color-brand-sub)">案件はまだありません。</div>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} p={p} />)
      )}
    </AppShell>
  );
}
