import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ログイン" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--color-brand-bg) p-4">
      <div className="w-full max-w-[360px] rounded-2xl border border-(--color-brand-line) bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[15px] font-black text-white">足</span>
          <span className="text-[15px] font-bold text-(--color-brand-ink)">足場信用プラットフォーム</span>
        </div>
        <p className="mb-5 text-[12.5px] text-(--color-brand-sub)">会社メンバー／本部管理者のログイン</p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="mt-4 text-center text-[12.5px] text-(--color-brand-sub)">
          はじめての方は <Link href="/signup" className="font-bold text-(--color-brand-blue)">会社を新規登録</Link>
        </div>
      </div>
    </div>
  );
}
