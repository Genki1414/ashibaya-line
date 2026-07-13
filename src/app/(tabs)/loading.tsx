import { AppBottomNav } from "@/components/app/AppBottomNav";

/** タブ配下の読み込み中に即表示するスケルトン（AppShell の枠に合わせて体感の待ちを消す）。
 *  下部ナビは本物を描画し、タブ切替時にチラつかず遷移先タブが即ハイライトされるようにする。 */
export default function TabsLoading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col overflow-x-clip bg-(--color-brand-bg)">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-(--color-brand-blue) px-4 py-3 text-white">
        <span className="h-7 w-7 rounded-lg bg-white/20" />
        <span className="h-4 w-28 rounded bg-white/25" />
        <span className="ml-auto h-7 w-16 rounded-lg bg-white/15" />
      </header>
      <main className="flex-1 space-y-3 overflow-x-clip p-4 pb-24">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
      </main>
      <AppBottomNav />
    </div>
  );
}
