import { Header } from "@/components/Header";

export default function ProjectsPage() {
  return (
    <>
      <Header title="案件" />
      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-sm text-(--color-brand-sub)">
          案件一覧（募集中・成立済み）をここに表示します。
        </div>
      </div>
    </>
  );
}
