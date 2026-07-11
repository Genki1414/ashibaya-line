export function Header({ title }: { title: string }) {
  return (
    <header className="flex shrink-0 items-center border-b border-(--color-brand-line) bg-white px-4 py-3">
      <h1 className="text-[15px] font-bold text-(--color-brand-ink)">{title}</h1>
    </header>
  );
}
