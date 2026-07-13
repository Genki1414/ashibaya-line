import type { TimelineEntry } from "@/lib/txTimeline";

const fmt = (s: string) => {
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${Number(m)}/${Number(d)}`;
};

const DOT: Record<TimelineEntry["kind"], { ring: string; fill: string }> = {
  normal: { ring: "var(--color-brand-line)", fill: "#fff" },
  milestone: { ring: "var(--color-brand-blue)", fill: "var(--color-brand-blue)" },
  credit: { ring: "var(--color-brand-green)", fill: "var(--color-brand-green)" },
};

/** 取引のドメインイベント履歴を、信用に効く節目を強調した縦型タイムラインで表示。 */
export function CreditTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-(--color-brand-line) bg-white p-5 text-center text-[12.5px] text-(--color-brand-sub)">
        まだ記録はありません。取引が進むと、ここに履歴が積み上がります。
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4">
      <ol className="relative">
        {entries.map((e, i) => {
          const dot = DOT[e.kind];
          const last = i === entries.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {/* 縦線 */}
              {!last && <span className="absolute left-[6px] top-4 h-full w-px bg-(--color-brand-line)" aria-hidden />}
              {/* ドット */}
              <span
                className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ background: dot.fill, boxShadow: `0 0 0 2px ${dot.ring}` }}
                aria-hidden
              />
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: e.kind === "credit" ? "var(--color-brand-green)" : "var(--color-brand-ink)" }}
                  >
                    {e.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-(--color-brand-faint)">{fmt(e.occurredAt)}</span>
                </div>
                {e.detail && <div className="mt-0.5 text-[12px] leading-relaxed text-(--color-brand-sub)">{e.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
