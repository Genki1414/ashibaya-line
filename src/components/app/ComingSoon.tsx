export function ComingSoon({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-(--color-brand-line) bg-white p-8 text-center">
      <div className="text-[34px]">{icon}</div>
      <div className="mt-2 text-[15px] font-bold text-(--color-brand-ink)">{title}</div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-(--color-brand-sub)">{note}</div>
      <div className="mt-3 inline-block rounded-full bg-(--color-brand-blue-light) px-3 py-1 text-[11.5px] font-bold text-(--color-brand-blue)">Phase 2 で接続予定</div>
    </div>
  );
}
