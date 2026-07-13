import { signOut } from "@/app/(auth)/actions";
import {
  Card,
  FactPanel,
  InfoRow,
  LEVEL_META,
  LevelBadge,
  PaymentMetrics,
  SectionLabel,
  StatusBadge,
  VerifyBadges,
  type MetricsView,
} from "@/components/company/parts";
import { RegisteredCompanies, type CompanyCard } from "@/components/company/RegisteredCompanies";

export interface SelfProfile {
  name: string;
  region: string;
  areas: string;
  works: string;
  contact: string;
  registeredAt: string;
  level: string;
  status: string;
  verify: Record<string, string>;
  metrics: MetricsView;
  facts: { concerns: string[]; positives: string[] };
}

export interface AppHomeProps {
  email: string;
  self: SelfProfile | null;
  companies: CompanyCard[];
}

function formatDate(s: string): string {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/** ログイン中の会社向けホーム＝自社プロフィール（実データ）＋登録会社一覧。プロトタイプの見た目に準拠。 */
export function AppHome({ email, self, companies }: AppHomeProps) {
  const levelStyle = self ? LEVEL_META[self.level] ?? LEVEL_META.unverified : LEVEL_META.unverified;

  return (
    <div className="mx-auto min-h-dvh max-w-[460px] bg-(--color-brand-bg) pb-10">
      <header className="flex items-center gap-2 bg-(--color-brand-blue) px-4 py-3 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-[13px] font-black">足</span>
        <span className="text-[15px] font-bold">自社プロフィール</span>
        <form action={signOut} className="ml-auto">
          <button className="rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white">ログアウト</button>
        </form>
      </header>

      <div className="p-4">
        {!self ? (
          <Card>
            <div className="text-[13px] text-(--color-brand-red)">会社に所属していません（{email}）。</div>
          </Card>
        ) : (
          <>
            {/* 自社カード */}
            <div className="mb-4 rounded-2xl border border-(--color-brand-line) bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-(--color-brand-blue) text-[22px] font-black text-white">{self.name.slice(0, 1)}</div>
                <div className="flex-1">
                  <div className="text-[16.5px] font-black text-(--color-brand-ink)">{self.name}</div>
                  <div className="text-[12px] text-(--color-brand-sub)">{[self.region, self.areas ? `${self.areas}対応` : ""].filter(Boolean).join(" ・ ")}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <LevelBadge level={self.level} size="lg" />
                  <StatusBadge status={self.status} />
                </div>
              </div>
              <div className="rounded-xl px-3 py-2.5 text-center text-[11.5px] font-bold" style={{ color: levelStyle.color, background: levelStyle.bg }}>
                信用レベルは取引実績と認証から自動判定されます
              </div>
            </div>

            {self.status !== "active" && (
              <div className="mb-4 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3.5 text-[12px] text-(--color-brand-sub)">
                {self.status === "pending"
                  ? "本部の承認待ちです。会社プロフィール・認証書類の準備は今すぐ行えます。案件の発注・受注は承認後に解禁されます。"
                  : "利用が停止されています。本部管理者にお問い合わせください。"}
              </div>
            )}

            <div className="mb-4">
              <SectionLabel text="確認できる事実" />
              <FactPanel concerns={self.facts.concerns} positives={self.facts.positives} />
            </div>

            <div className="mb-4">
              <SectionLabel text="支払い実績" />
              <PaymentMetrics m={self.metrics} />
            </div>

            <div className="mb-4">
              <SectionLabel text="認証バッジ" />
              <Card>
                <VerifyBadges verify={self.verify} />
              </Card>
            </div>

            <div className="mb-6">
              <SectionLabel text="会社情報" />
              <Card className="px-3.5 py-0">
                <InfoRow label="担当者" value={self.contact} />
                <InfoRow label="対応地域" value={self.areas || self.region} />
                <InfoRow label="対応工事" value={self.works} />
                <InfoRow label="登録日" value={formatDate(self.registeredAt)} />
              </Card>
            </div>
          </>
        )}

        <SectionLabel text={`登録会社一覧（${companies.length}）`} />
        <RegisteredCompanies companies={companies} />
      </div>
    </div>
  );
}
