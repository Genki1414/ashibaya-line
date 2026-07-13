import { AppShell } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "パートナー" };

// 掲載パートナー（プロトタイプの PARTNERS を移植。収益基盤の掲載枠）。
const PARTNERS = [
  { name: "トーホク仮設資材", cat: "資材", svc: "くさび足場・単管の販売", area: "東北全域", perk: "会員価格10%OFF", certified: true },
  { name: "みちのくレンタル", cat: "レンタル", svc: "高所作業車・発電機レンタル", area: "宮城・福島", perk: "初回50%OFF", certified: true },
  { name: "あんしん保証サービス", cat: "保証", svc: "売掛保証・与信管理", area: "全国", perk: "審査料無料", certified: true },
  { name: "スピード入金ファクタリング", cat: "金融", svc: "請求書の早期現金化", area: "全国", perk: "手数料優遇", certified: false },
  { name: "東北建設保険センター", cat: "保険", svc: "労災・賠償責任保険", area: "東北全域", perk: "一人親方特別加入対応", certified: true },
  { name: "現場会計クラウド", cat: "会計", svc: "建設業向け会計ソフト", area: "全国", perk: "3ヶ月無料", certified: true },
];

export default function PartnersTab() {
  return (
    <AppShell title="パートナー">
      <div className="mb-3.5 rounded-2xl border border-(--color-brand-blue-light) bg-(--color-brand-blue-soft) p-3 text-[12px] leading-relaxed text-(--color-brand-sub)">
        資材・レンタル・保険・保証・金融・会計など、足場会社の業務を支えるパートナーの掲載枠です。
      </div>
      <div className="space-y-3">
        {PARTNERS.map((p) => (
          <div key={p.name} className="rounded-2xl border border-(--color-brand-line) bg-white p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-blue)">{p.cat}</span>
              {p.certified && <span className="rounded-full bg-(--color-brand-green-soft) px-2 py-0.5 text-[11px] font-bold text-(--color-brand-green)">認定パートナー</span>}
            </div>
            <div className="text-[14.5px] font-bold text-(--color-brand-ink)">{p.name}</div>
            <div className="mt-0.5 text-[12.5px] text-(--color-brand-sub)">{p.svc}</div>
            <div className="mt-2 flex items-center justify-between border-t border-(--color-brand-line) pt-2">
              <span className="text-[11.5px] text-(--color-brand-sub)">対応：{p.area}</span>
              <span className="text-[12px] font-bold text-(--color-brand-gold)">特典：{p.perk}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-[11px] text-(--color-brand-faint)">
        掲載・申込の導線は今後接続します（表示のみ）。
      </div>
    </AppShell>
  );
}
