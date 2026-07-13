import { AppShell } from "@/components/app/AppShell";
import { ComingSoon } from "@/components/app/ComingSoon";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件" };

export default function ProjectsTab() {
  return (
    <AppShell title="案件">
      <ComingSoon
        icon="▤"
        title="案件（募集・応募・選定）"
        note="案件の投稿・応募・協力会社の選定をここで行います。発注・受注は本部承認後に解禁されます。"
      />
    </AppShell>
  );
}
