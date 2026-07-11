import { Header } from "@/components/Header";

export default function PartnersPage() {
  return (
    <>
      <Header title="パートナー" />
      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
          資材・レンタル・保険・保証・金融・会計などのパートナー掲載をここに表示します。
        </div>
      </div>
    </>
  );
}
