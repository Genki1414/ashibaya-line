import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import {
  Card,
  FactPanel,
  InfoRow,
  LevelBadge,
  MiniStat,
  PaymentMetrics,
  SectionLabel,
  StatusBadge,
  VerifyBadges,
  type MetricsView,
} from "@/components/company/parts";
import { loadProjectDetail } from "@/server/projectData";
import { getAuthContext } from "@/server/auth";
import { companyCreditLevel, companyFactsOf, type Company } from "@/domain/company";
import { continuousCount } from "@/domain/credit";
import { ApplyButton, SelectButton } from "./buttons";

export const dynamic = "force-dynamic";

const yen = (n: number) => "¥" + Number(n).toLocaleString();
const d = (s: string | null) => {
  if (!s) return "-";
  const [y, m, dd] = s.split("-");
  return `${Number(y)}年${Number(m)}月${Number(dd)}日`;
};
const JOB_LABEL: Record<string, string> = { support: "応援（人工）", contract: "請負（一式）" };
const PAY_LABEL: Record<string, string> = { progress: "出来高（組立/解体）", lump: "一括" };

function metricsView(c: Company): MetricsView {
  return {
    completed: c.metrics.completed,
    paidCount: c.metrics.paidCount,
    onTimeCount: c.metrics.onTimeCount,
    lateCount: c.metrics.lateCount,
    avgPayDays: c.metrics.avgPayDays,
    lastTrade: c.metrics.lastTrade,
    continuous: continuousCount(c.metrics),
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadProjectDetail(id);
  if (!detail) notFound();
  const { project, prime, applicants } = detail;

  const ctx = await getAuthContext();
  const myCompanyId = ctx.companyId;
  const isPrime = myCompanyId != null && myCompanyId === (project.primeId as unknown as string);
  const alreadyApplied = myCompanyId != null && project.applicantIds.some((a) => (a as unknown as string) === myCompanyId);
  const recruiting = project.stage === "recruiting";

  // 応募可否：元請ではなく、まだ応募していない募集中案件のみ。受注可否（本部承認）は Server Action 側でも再確認。
  const canApply = Boolean(myCompanyId) && !isPrime && !alreadyApplied && recruiting;

  const today = new Date().toISOString().slice(0, 10);
  const primeFacts = prime ? companyFactsOf(prime, false, today) : null;

  return (
    <AppShell title={project.name} back="/projects">
      <div className="space-y-4">
        {/* 元請本人・募集中のみ編集可 */}
        {isPrime && recruiting && (
          <Link
            href={`/projects/${project.id as unknown as string}/edit`}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-brand-blue) bg-(--color-brand-blue-soft) py-2.5 text-[13.5px] font-bold text-(--color-brand-blue)"
          >
            ✎ 案件内容を編集する
          </Link>
        )}
        {/* 元請の信用 */}
        {prime && (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-(--color-brand-faint)">元請（発注者）</div>
                <div className="text-[16px] font-bold text-(--color-brand-ink)">{prime.name}</div>
                <div className="mt-0.5 text-[12px] text-(--color-brand-sub)">{prime.region}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <LevelBadge level={companyCreditLevel(prime, false)} size="lg" />
                <StatusBadge status={prime.status ?? "active"} />
              </div>
            </div>
            <div className="my-3 grid grid-cols-3 gap-1 rounded-2xl bg-(--color-brand-bg) py-3">
              <MiniStat n={prime.metrics.completed} label="取引完了" />
              <MiniStat n={prime.metrics.onTimeCount} label="期日内支払" />
              <MiniStat n={prime.metrics.lateCount} label="支払遅延" red={prime.metrics.lateCount > 0} />
            </div>
            <VerifyBadges verify={prime.verify as Record<string, string>} />
          </Card>
        )}

        {/* 募集要項 */}
        <div>
          <SectionLabel text="募集要項" />
          <Card className="!py-1">
            <InfoRow label="種別" value={JOB_LABEL[project.jobType] ?? project.jobType} />
            <InfoRow label="地域" value={project.region} />
            <InfoRow label="現場住所" value={project.address} />
            <InfoRow label="工期" value={`${d(project.overallSchedule.plannedStart)} 〜 ${d(project.overallSchedule.plannedEnd)}`} />
            <InfoRow label="組立予定" value={`${d(project.assemblySchedule.plannedStart)} 〜 ${d(project.assemblySchedule.plannedEnd)}`} />
            <InfoRow label="解体予定" value={`${d(project.dismantleSchedule.plannedStart)} 〜 ${d(project.dismantleSchedule.plannedEnd)}`} />
            <InfoRow label={project.jobType === "contract" ? "請負金額" : "単価（日額）"} value={yen(project.unitPrice)} />
            {project.need != null && <InfoRow label="募集人数" value={`${project.need}名`} />}
            <InfoRow label="支払方式" value={PAY_LABEL[project.payType] ?? project.payType} />
            <InfoRow label="支払条件" value={`${project.closing}締め・${project.payTerm}払い`} />
            <InfoRow label="持ち物" value={project.belongings} />
            <InfoRow label="募集締切" value={d(project.applicationDeadline)} />
            <InfoRow label="売掛保証" value="受注時に受注側が選択" />
          </Card>
          {project.workDescription && (
            <div className="mt-2 rounded-2xl border border-(--color-brand-line) bg-white p-3.5 text-[13px] leading-relaxed text-(--color-brand-ink)">
              {project.workDescription}
            </div>
          )}
        </div>

        {/* 元請の支払い実績 */}
        {prime && (
          <div>
            <SectionLabel text="元請の支払い実績" />
            <PaymentMetrics m={metricsView(prime)} />
          </div>
        )}

        {/* 元請の確認事項 */}
        {primeFacts && (
          <div>
            <SectionLabel text="確認できる事実" />
            <FactPanel concerns={[...primeFacts.concerns]} positives={[...primeFacts.positives]} />
          </div>
        )}

        {/* 応募一覧（元請にのみ選定ボタン表示） */}
        <div>
          <SectionLabel text={`応募会社（${applicants.length}）`} />
          {applicants.length === 0 ? (
            <div className="rounded-2xl border border-(--color-brand-line) bg-white p-5 text-center text-[13px] text-(--color-brand-sub)">
              まだ応募はありません。
            </div>
          ) : (
            <div className="space-y-2.5">
              {applicants.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14.5px] font-bold text-(--color-brand-ink)">
                        {a.name}
                        {a.id === myCompanyId && <span className="ml-1 text-[11px] text-(--color-brand-blue)">（自社）</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-(--color-brand-sub)">{a.region}・完了{a.metrics.completed}件</div>
                    </div>
                    <LevelBadge level={companyCreditLevel(a, true)} />
                  </div>
                  {isPrime && recruiting && (
                    <div className="mt-3 flex">
                      <SelectButton projectId={project.id as unknown as string} partnerId={a.id} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 応募アクション（非元請の会社向け） */}
        {!isPrime && myCompanyId && (
          <div className="pt-1">
            {alreadyApplied ? (
              <div className="rounded-xl bg-(--color-brand-green-soft) px-3 py-3 text-center text-[13.5px] font-bold text-(--color-brand-green)">
                応募済みです。元請の選定をお待ちください。
              </div>
            ) : !recruiting ? (
              <div className="rounded-xl bg-(--color-brand-bg) px-3 py-3 text-center text-[13px] text-(--color-brand-sub)">
                この案件は選定済みです。
              </div>
            ) : (
              <ApplyButton projectId={project.id as unknown as string} disabled={!canApply} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
