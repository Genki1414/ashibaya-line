import { actingSwitchEnabled, currentCompanyId } from "@/server/acting";
import { createClient } from "@/lib/supabase/server";
import { DevSwitcherClient, type DevCompany } from "./DevSwitcherClient";

/** リリース前限定の会社切り替えツール。NEXT_PUBLIC_ALLOW_ACTING_SWITCH=1 のときだけ描画。 */
export async function DevSwitcher() {
  if (!actingSwitchEnabled()) return null;

  let companies: DevCompany[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("companies").select("id, name, status").order("created_at", { ascending: true });
    companies = (data ?? []).map((r) => {
      const c = r as { id: string; name: string; status: string | null };
      return { id: c.id, name: c.name, status: c.status };
    });
  } catch {
    return null; // Supabase 未接続などのときは何も出さない
  }

  const actingId = await currentCompanyId();
  return <DevSwitcherClient companies={companies} actingId={actingId} />;
}
