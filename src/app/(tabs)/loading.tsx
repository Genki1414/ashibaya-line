/** タブ配下の読み込み中に即表示するスケルトン（AppShell の枠に合わせて体感の待ちを消す）。 */
export default function TabsLoading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[460px] flex-col bg-(--color-brand-bg)">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-(--color-brand-blue) px-4 py-3 text-white">
        <span className="h-7 w-7 rounded-lg bg-white/20" />
        <span className="h-4 w-28 rounded bg-white/25" />
        <span className="ml-auto h-7 w-16 rounded-lg bg-white/15" />
      </header>
      <main className="flex-1 space-y-3 p-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-16 animate-pulse rounded-2xl bg-white" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
      </main>
      <nav className="sticky bottom-0 flex border-t border-(--color-brand-line) bg-white px-1 pb-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="h-5 w-5 rounded bg-(--color-brand-line)" />
            <span className="h-2 w-8 rounded bg-(--color-brand-line)" />
          </div>
        ))}
      </nav>
    </div>
  );
}
