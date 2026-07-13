import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--color-brand-bg) p-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-(--color-brand-line) bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[15px] font-black text-white">足</span>
          <span className="text-[15px] font-bold text-(--color-brand-ink)">会社の新規登録</span>
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-(--color-brand-sub)">
          自社を登録するとすぐにログインできます。案件の発注・受注は本部の承認後に解禁されます。
        </p>
        <SignupForm />
        <div className="mt-4 text-center text-[12.5px] text-(--color-brand-sub)">
          すでに登録済みの方は <Link href="/login" className="font-bold text-(--color-brand-blue)">ログイン</Link>
        </div>
      </div>
    </div>
  );
}
