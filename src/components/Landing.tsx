import Link from "next/link";

/** 未ログインでトップに来た人向けの公開ランディング（サービス紹介＋導線）。実データは出さない。 */
export function Landing() {
  return (
    <div className="min-h-dvh bg-(--color-brand-bg)">
      <header className="flex items-center gap-2 border-b border-(--color-brand-line) bg-white px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-brand-blue) text-[15px] font-black text-white">足</span>
        <span className="text-[15px] font-bold text-(--color-brand-ink)">足場信用プラットフォーム</span>
        <div className="ml-auto flex gap-2">
          <Link href="/login" className="rounded-lg border border-(--color-brand-line) px-3 py-1.5 text-[12.5px] font-bold text-(--color-brand-sub)">ログイン</Link>
          <Link href="/signup" className="rounded-lg bg-(--color-brand-blue) px-3 py-1.5 text-[12.5px] font-bold text-white">会社を登録</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-10">
        <div className="rounded-2xl bg-gradient-to-br from-(--color-brand-blue) to-(--color-brand-blue-dark) p-7 text-white">
          <div className="text-[13px] font-bold opacity-90">足場会社グループのための</div>
          <h1 className="mt-1 text-[26px] font-black leading-tight">事実で信用を積む<br />クレジットプラットフォーム</h1>
          <p className="mt-3 text-[13.5px] leading-relaxed opacity-95">
            組立・解体・是正・支払い・入金の記録が、そのまま会社の信用になります。
            初めての相手とでも、検証できる事実をもとに安全に取引できる場です。募集の入口はLINE、正式な取引と記録はここで。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/signup" className="rounded-xl bg-white px-5 py-2.5 text-[14px] font-bold text-(--color-brand-blue)">会社を新規登録</Link>
            <Link href="/login" className="rounded-xl border border-white/60 px-5 py-2.5 text-[14px] font-bold text-white">ログイン</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { t: "検証できる事実", d: "星評価ではなく、取引・支払い・入金・認証の実績で信用を可視化。" },
            { t: "独立二相の取引", d: "組立と解体を独立進行。二者確認・是正ループで安全に記録。" },
            { t: "関係者限定", d: "取引の中身は当事者と運営のみ閲覧。会社の信用情報は公開。" },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-(--color-brand-line) bg-white p-4">
              <div className="text-[13.5px] font-bold text-(--color-brand-ink)">{c.t}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-(--color-brand-sub)">{c.d}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-[12px] text-(--color-brand-faint)">
          デザインの試作版は <Link href="/preview" className="font-bold text-(--color-brand-blue)">プロトタイプ（/preview）</Link> で確認できます。
        </div>
      </main>
    </div>
  );
}
