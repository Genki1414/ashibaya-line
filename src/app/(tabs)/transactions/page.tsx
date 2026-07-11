import { Header } from "@/components/Header";

export default function TransactionsPage() {
  return (
    <>
      <Header title="取引" />
      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
          取引中・是正/手直し・請求/入金・確認事項・完了のタブ別一覧をここに表示します。
        </div>
      </div>
    </>
  );
}
