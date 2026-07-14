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
import { PrimePerformanceCard } from "@/components/company/PerformancePanel";
import { ProjectDocsReadonly } from "@/components/project/DocsDisplay";
import { loadProjectDetail } from "@/server/projectData";
import { loadUnreadChats } from "@/server/chatData";
import { loadCompanyPerformance } from "@/server/performanceData";
import { loadProjectDocuments } from "@/server/projectDocs";
import { currentCompanyId } from "@/server/acting";
import { companyCreditLevel, companyFactsOf, type Company } from "@/domain/company";
import { continuousCount } from "@/domain/credit";
import { ApplyButton, SelectButton, WithdrawButton, ListingButton } from "./buttons";

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

  const myCompanyId = await currentCompanyId();
  const isPrime = myCompanyId != null && myCompanyId === (project.primeId as unknown as string);
  const alreadyApplied = myCompanyId != null && project.applicantIds.some((a) => (a as unknown as string) === myCompanyId);
  const recruiting = project.stage === "recruiting";
  const paused = project.stage === "paused";
  const matched = project.stage === "matched";
  const closed = project.stage === "closed";
  const pid = project.id as unknown as string;

  // 応募可否：元請ではなく、まだ応募していない募集中案件のみ。受注可否（本部承認）は Server Action 側でも再確認。
  const canApply = Boolean(myCompanyId) && !isPrime && !alreadyApplied && recruiting;

  const today = new Date().toISOString().slice(0, 10);
  const primeFacts = prime ? companyFactsOf(prime, false, today) : null;
  const primePerf = prime ? await loadCompanyPerformance(project.primeId as unknown as string) : null;
  const { docs: projectDocs, canManage: canManageDocs } = await loadProjectDocuments(id, myCompanyId);

  const unreadByChatKey = new Map((await loadUnreadChats()).map((c) => [c.chatKey, c.count]));
  const unreadFor = (companyId: string) => unreadByChatKey.get(`${project.id as unknown as string}:${companyId}`) ?? 0;

  return (
    <AppShell title={project.name} back="/projects">
      <div className="space-y-4">
        {/* 状態バナー（一時停止中・掲載終了） */}
        {paused && (
          <div className="rounded-xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) px-3 py-2.5 text-[12.5px] font-bold text-(--color-brand-amber)">
            この案件は現在、募集を一時停止中です（検索・一覧に表示されません）。
          </div>
        )}
        {closed && (
          <div className="rounded-xl border border-(--color-brand-line) bg-(--color-brand-bg) px-3 py-2.5 text-[12.5px] font-bold text-(--color-brand-sub)">
            この案件は掲載を終了しています。
          </div>
        )}

        {/* 元請の掲載管理（編集・一時停止／再開・削除） */}
        {isPrime && (recruiting || paused) && (
          <div className="space-y-2">
            <Link
              href={`/projects/${pid}/edit`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-brand-blue) bg-(--color-brand-blue-soft) py-2.5 text-[13.5px] font-bold text-(--color-brand-blue)"
            >
              ✎ 案件内容を編集する
            </Link>
            <div className="flex gap-2">
              {recruiting && <ListingButton projectId={pid} op="pause" />}
              {paused && <ListingButton projectId={pid} op="resume" />}
              <ListingButton projectId={pid} op="close" />
            </div>
          </div>
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
        {/* 元請の客観実績（取引履歴から自動集計・編集不可）。信用レベルとは別に事実を提示。 */}
        {primePerf && (
          <div>
            <SectionLabel text="元請の実績データ（事実集計）" />
            <PrimePerformanceCard p={primePerf.asPrime} />
          </div>
        )}
        {/* 案件資料（公開範囲に応じて表示。管理は元請のみ） */}
        <div id="docs" className="scroll-mt-16">
          <SectionLabel
            text="案件資料"
            right={canManageDocs ? (
              <Link href={`/projects/${project.id as unknown as string}/documents`} className="text-[12px] font-bold text-(--color-brand-blue)">＋ 管理</Link>
            ) : undefined}
          />
          {projectDocs.length > 0 ? (
            <ProjectDocsReadonly docs={projectDocs} />
          ) : (
            <Card>
              <div className="text-[12.5px] text-(--color-brand-sub)">
                {canManageDocs ? "まだ資料はありません。「＋ 管理」から図面・写真・書類を追加できます。" : "公開されている資料はありません。"}
              </div>
            </Card>
          )}
        </div>

        {/* 募集要項 */}
        <div>
          <SectionLabel text="募集要項" />
          <Card className="!py-1">
            <InfoRow label="種別" value={JOB_LABEL[project.jobType] ?? project.jobType} />
            <InfoRow label="地域" value={project.region} />
            <InfoRow label="現場住所" value={project.address} />
            <InfoRow label="工期" value={`${d(project.overallSchedule.plannedStart)} 〜 ${d(project.overallSchedule.plannedEnd)}`} />
            {project.jobType === "support" ? (
              <InfoRow label="作業予定" value={`${d(project.assemblySchedule.plannedStart)} 〜 ${d(project.assemblySchedule.plannedEnd)}`} />
            ) : (
              <>
                <InfoRow label="組立予定" value={`${d(project.assemblySchedule.plannedStart)} 〜 ${d(project.assemblySchedule.plannedEnd)}`} />
                <InfoRow label="解体予定" value={`${d(project.dismantleSchedule.plannedStart)} 〜 ${d(project.dismantleSchedule.plannedEnd)}`} />
              </>
            )}
            <InfoRow label={project.jobType === "contract" ? "請負金額" : "単価（日額）"} value={yen(project.unitPrice)} />
            {project.need != null && <InfoRow label="募集人数" value={`${project.need}名`} />}
            <InfoRow label="支払方式" value={PAY_LABEL[project.payType] ?? project.payType} />
            <InfoRow label="支払条件" value={`${project.closing}締め・${project.payTerm}払い`} />
            <InfoRow label="持ち物" value={project.belongings} />
            <InfoRow label="募集締切" value={d(project.applicationDeadline)} />
            <InfoRow label="売掛保証" value="受注時に受注側が選択" />
            <InfoRow label="応募状況" value={recruiting ? `現在 ${project.applicantIds.length} 社が応募中` : "選定済み"} />
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

        {/* 応募一覧は元請本人にのみ表示（第三者・他の応募者からは閲覧不可） */}
        {isPrime && (
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
                    <Link
                      href={`/companies/${a.id}?from=/projects/${project.id as unknown as string}`}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[14.5px] font-bold text-(--color-brand-ink)">{a.name}</div>
                        <div className="mt-0.5 text-[12px] text-(--color-brand-sub)">{a.region}・完了{a.metrics.completed}件</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <LevelBadge level={companyCreditLevel(a, true)} />
                        <span className="text-[13px] font-bold text-(--color-brand-blue)">›</span>
                      </div>
                    </Link>
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id as unknown as string}/chat/${a.id}`}
                        className="flex items-center gap-1.5 rounded-xl border border-(--color-brand-blue) px-3 py-2 text-[13px] font-bold text-(--color-brand-blue)"
                      >
                        チャット
                        {unreadFor(a.id) > 0 && (
                          <span className="rounded-full bg-(--color-brand-red) px-1.5 py-0.5 text-[10.5px] font-bold text-white">{unreadFor(a.id)}</span>
                        )}
                      </Link>
                      {recruiting && <SelectButton projectId={project.id as unknown as string} partnerId={a.id} />}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 応募アクション／状態（非元請の会社向け。自分の応募状態のみ表示） */}
        {!isPrime && myCompanyId && (
          <div className="space-y-2 pt-1">
            {alreadyApplied && (recruiting || paused) ? (
              <>
                <div className="rounded-xl bg-(--color-brand-blue-soft) px-3 py-3 text-center text-[13.5px] font-bold text-(--color-brand-blue)">
                  応募中です。{paused ? "現在この案件は一時停止中です。" : "元請の選定をお待ちください。"}
                </div>
                <WithdrawButton projectId={pid} />
              </>
            ) : alreadyApplied && matched ? (
              <div className="rounded-xl bg-(--color-brand-bg) px-3 py-3 text-center text-[13px] text-(--color-brand-sub)">
                この案件の選定は終了しました。受注できた場合は「取引」タブに表示されます。
              </div>
            ) : paused ? (
              <div className="rounded-xl bg-(--color-brand-bg) px-3 py-3 text-center text-[13px] text-(--color-brand-sub)">
                この案件は現在、募集を一時停止しています。
              </div>
            ) : closed ? (
              <div className="rounded-xl bg-(--color-brand-bg) px-3 py-3 text-center text-[13px] text-(--color-brand-sub)">
                この案件は掲載を終了しました。
              </div>
            ) : matched ? (
              <div className="rounded-xl bg-(--color-brand-bg) px-3 py-3 text-center text-[13px] text-(--color-brand-sub)">
                この案件は選定済みです。
              </div>
            ) : (
              <ApplyButton projectId={pid} disabled={!canApply} />
            )}
            {alreadyApplied && !matched && (
              <Link
                href={`/projects/${pid}/chat/${myCompanyId}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-brand-blue) py-2.5 text-center text-[13.5px] font-bold text-(--color-brand-blue)"
              >
                元請とチャットする
                {unreadFor(myCompanyId) > 0 && (
                  <span className="rounded-full bg-(--color-brand-red) px-1.5 py-0.5 text-[10.5px] font-bold text-white">{unreadFor(myCompanyId)}</span>
                )}
              </Link>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
