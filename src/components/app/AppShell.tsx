import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { AppBottomNav } from "./AppBottomNav";

/** 会社向けアプリの共通シェル：青ヘッダー（戻る/タイトル/ログアウト）＋本文＋下部5タブ。 */
export function AppShell({
  title,
  back,
  noPad,
  hideNav,
  children,
}: {
  title: string;
  back?: string;
  noPad?: boolean;
  hideNav?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[460px] flex-col bg-(--color-brand-bg)">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-(--color-brand-blue) px-4 py-3 text-white">
        {back ? (
          <Link href={back} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[16px] leading-none">‹</Link>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-[13px] font-black">足</span>
        )}
        <span className="text-[15px] font-bold">{title}</span>
        <form action={signOut} className="ml-auto">
          <button className="rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white">ログアウト</button>
        </form>
      </header>
      <main className={noPad ? "flex-1" : "flex-1 p-4 pb-24"}>{children}</main>
      {!hideNav && <AppBottomNav />}
    </div>
  );
}
