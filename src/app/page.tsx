import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

/**
 * トップ「/」：未ログイン→公開ランディング／本部管理者→/admin／利用会社→アプリ(/home)。
 * プロトタイプ（デザイン参照）は /preview。設定不備でも 500 にせずランディングにフォールバック。
 */
export default async function Home() {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return <Landing />;
  }
  if (!ctx.user) return <Landing />;
  if (ctx.isAdmin) redirect("/admin");
  redirect("/home");
}
