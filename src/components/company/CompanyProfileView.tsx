import { FactPanel, InfoRow, LEVEL_META, LevelBadge, PaymentMetrics, StatusBadge, VerifyBadges, type MetricsView } from "./parts";
import { ProfileSection } from "./ProfileSection";

export interface CompanyProfileData {
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

function formatDate(s: string): string {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/** 会社プロフィール（自社・他社共通）。各項目はクリックで開閉。 */
export function CompanyProfileView({ profile, selfBadge, banner }: { profile: CompanyProfileData; selfBadge?: boolean; banner?: React.ReactNode }) {
  const levelStyle = LEVEL_META[profile.level] ?? LEVEL_META.unverified;
  return (
    <>
      <div className="mb-4 rounded-2xl border border-(--color-brand-line) bg-white p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-(--color-brand-blue) text-[22px] font-black text-white">{profile.name.slice(0, 1)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[16.5px] font-black text-(--color-brand-ink)">{profile.name}</span>
              {selfBadge && <span className="rounded-full bg-(--color-brand-blue-light) px-1.5 py-0.5 text-[10px] font-bold text-(--color-brand-blue)">自社</span>}
            </div>
            <div className="text-[12px] text-(--color-brand-sub)">{[profile.region, profile.areas ? `${profile.areas}対応` : ""].filter(Boolean).join(" ・ ")}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <LevelBadge level={profile.level} size="lg" />
            <StatusBadge status={profile.status} />
          </div>
        </div>
        <div className="rounded-xl px-3 py-2.5 text-center text-[11.5px] font-bold" style={{ color: levelStyle.color, background: levelStyle.bg }}>
          信用レベルは取引実績と認証から自動判定されます
        </div>
      </div>

      {banner}

      <ProfileSection title="確認できる事実" defaultOpen>
        <FactPanel concerns={profile.facts.concerns} positives={profile.facts.positives} />
      </ProfileSection>
      <ProfileSection title="支払い実績">
        <PaymentMetrics m={profile.metrics} />
      </ProfileSection>
      <ProfileSection title="認証バッジ">
        <VerifyBadges verify={profile.verify} />
      </ProfileSection>
      <ProfileSection title="会社情報">
        <InfoRow label="担当者" value={profile.contact} />
        <InfoRow label="対応地域" value={profile.areas || profile.region} />
        <InfoRow label="対応工事" value={profile.works} />
        <InfoRow label="登録日" value={formatDate(profile.registeredAt)} />
      </ProfileSection>
    </>
  );
}
