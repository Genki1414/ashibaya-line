import { CompanyProfileView, type CompanyProfileData } from "@/components/company/CompanyProfileView";

export type SelfProfile = CompanyProfileData;

/** 自社プロフィール（プロトタイプの CompanyProfile 相当・実データ）。各項目はクリックで展開。 */
export function SelfProfileView({ self }: { self: SelfProfile }) {
  const banner =
    self.status !== "active" ? (
      <div className="mb-4 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3.5 text-[12px] text-(--color-brand-sub)">
        {self.status === "pending"
          ? "本部の承認待ちです。会社プロフィール・認証書類の準備は今すぐ行えます。案件の発注・受注は承認後に解禁されます。"
          : "利用が停止されています。本部管理者にお問い合わせください。"}
      </div>
    ) : null;

  return <CompanyProfileView profile={self} selfBadge banner={banner} />;
}
