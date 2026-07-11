import { Header } from "@/components/Header";

export default function MePage() {
  return (
    <>
      <Header title="自社" />
      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
          自社プロフィール・登録会社一覧・LINE連携・認証管理・運営管理への導線をここに表示します。
        </div>
      </div>
    </>
  );
}
