import { AppShell } from "@/components/app/AppShell";
import { ComingSoon } from "@/components/app/ComingSoon";

export const dynamic = "force-dynamic";
export const metadata = { title: "取引" };

export default function TransactionsTab() {
  return (
    <AppShell title="取引">
      <ComingSoon
        icon="⇄"
        title="取引（独立二相エンジン）"
        note="注文書・注文請書、組立/解体の作業報告・完了確認・是正、請求・入金の二者確認まで、この画面で進めます。"
      />
    </AppShell>
  );
}
