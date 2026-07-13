import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadCompanyPageData } from "@/server/companyData";
import { JobForm } from "../JobForm";
import { postProjectAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "案件を投稿" };

export default async function NewProjectPage() {
  const { self } = await loadCompanyPageData();
  if (self && self.status !== "active") redirect("/projects");
  return (
    <AppShell title="案件を投稿" back="/projects">
      <JobForm mode="create" action={postProjectAction} />
    </AppShell>
  );
}
