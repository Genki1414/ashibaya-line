import type { ReactNode } from "react";

// 仕様書1章「約390px幅のスマホフレーム（ヘッダー＋スクロール本文＋下部ナビ＋トースト）」に対応。
export function PhoneFrame({
  header,
  bottomNav,
  children,
}: {
  header?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-(--color-brand-bg) sm:py-6">
      <div className="flex w-full max-w-[390px] flex-col bg-(--color-brand-bg) sm:h-[844px] sm:overflow-hidden sm:rounded-[36px] sm:border sm:border-(--color-brand-line) sm:shadow-xl">
        {header}
        <main className="flex-1 overflow-y-auto">{children}</main>
        {bottomNav}
      </div>
    </div>
  );
}
