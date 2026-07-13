import Link from "next/link";
import { loadNotifications, type NotificationKind } from "@/server/notifications";

const KIND_META: Record<NotificationKind, { color: string; bg: string }> = {
  応募: { color: "#C77700", bg: "#FCF2DF" },
  選定: { color: "#1657C9", bg: "#E8F0FE" },
  受注: { color: "#159B67", bg: "#E4F6EE" },
};

/** ホーム・案件タブに置く通知欄（サーバーコンポーネント）。空のときは控えめな表示。 */
export async function Notifications({ emptyHint = true }: { emptyHint?: boolean }) {
  const items = await loadNotifications();

  return (
    <div className="mb-4 rounded-2xl border border-(--color-brand-line) bg-white p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[14px]" aria-hidden>🔔</span>
        <span className="text-[13.5px] font-bold text-(--color-brand-ink)">通知</span>
        {items.length > 0 && (
          <span className="rounded-full bg-(--color-brand-red) px-2 py-0.5 text-[11px] font-bold text-white">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        emptyHint ? <div className="text-[12.5px] text-(--color-brand-sub)">新しい通知はありません。</div> : null
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => {
            const m = KIND_META[n.kind];
            return (
              <Link key={i} href={n.href} className="flex items-center gap-2.5 rounded-xl bg-(--color-brand-bg) p-2.5">
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: m.color, background: m.bg }}>{n.kind}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-(--color-brand-ink)">{n.title}</div>
                  <div className="truncate text-[12px] text-(--color-brand-sub)">{n.body}</div>
                </div>
                <span className="shrink-0 text-[13px] font-bold text-(--color-brand-blue)">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
