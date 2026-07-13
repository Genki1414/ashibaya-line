import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { DevSwitcher } from "@/components/dev/DevSwitcher";

/**
 * 会社向けアプリのタブ群（ホーム/案件/取引/パートナー/自社）のガード。
 * 未ログイン→/login、本部管理者→/admin、利用会社→各タブ（AppShell で描画）。
 */
export default async function TabsLayout({ children }: { children: ReactNode }) {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/login");
  }
  if (!ctx.user) redirect("/login?next=/home");
  if (ctx.isAdmin) redirect("/admin");
  return (
    <>
      {children}
      <DevSwitcher />
    </>
  );
}
