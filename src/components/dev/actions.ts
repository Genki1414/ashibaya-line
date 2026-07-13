"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTING_COMPANY_COOKIE, actingSwitchEnabled } from "@/server/acting";

/** テスト用：操作する会社を切り替える（フラグ有効時のみ）。 */
export async function setActingCompanyAction(companyId: string): Promise<void> {
  if (!actingSwitchEnabled()) return;
  const store = await cookies();
  store.set(ACTING_COMPANY_COOKIE, companyId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

/** テスト用：切り替えを解除し、ログインセッションの会社に戻す。 */
export async function clearActingCompanyAction(): Promise<void> {
  if (!actingSwitchEnabled()) return;
  const store = await cookies();
  store.delete(ACTING_COMPANY_COOKIE);
  revalidatePath("/", "layout");
}
