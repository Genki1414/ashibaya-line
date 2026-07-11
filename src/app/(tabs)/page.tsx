import { Header } from "@/components/Header";

export default function HomePage() {
  return (
    <>
      <Header title="ホーム" />
      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
          要対応の取引アラート・新着案件・登録会社一覧への導線をここに表示します。
        </div>
      </div>
    </>
  );
}
