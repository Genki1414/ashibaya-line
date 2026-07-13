// プロトタイプ（docs/ashiba_platform_v8.jsx）の会社系UIを、実データ表示用に移植した表示パーツ。
// サーバー/クライアント双方から使える純粋な表示コンポーネント。

export const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  unverified: { label: "未認証", color: "#8A93A3", bg: "#EEF1F5" },
  bronze: { label: "Bronze", color: "#A9713B", bg: "#F6ECE1" },
  silver: { label: "Silver", color: "#6B7684", bg: "#EEF1F5" },
  gold: { label: "Gold", color: "#C79A2E", bg: "#FBF2D9" },
  platinum: { label: "Platinum", color: "#6D4AC4", bg: "#EEE9FA" },
};

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "承認待ち", color: "#E39A2B", bg: "#FCF2DF" },
  active: { label: "取引可", color: "#159B67", bg: "#E4F6EE" },
  suspended: { label: "停止中", color: "#E5484D", bg: "#FCEBEC" },
};

export const VERIFY_LABELS: Record<string, string> = {
  phone: "電話番号確認",
  email: "メールアドレス確認",
  corp: "法人番号確認",
  rep: "代表者確認",
  address: "所在地確認",
  license: "建設業許可確認",
  invoice: "インボイス登録確認",
  labor: "労災保険確認",
  liability: "賠償責任保険確認",
  sole: "一人親方特別加入確認",
  qual: "保有資格確認",
  harness: "フルハーネス特別教育確認",
};

export interface MetricsView {
  completed: number;
  paidCount: number;
  onTimeCount: number;
  lateCount: number;
  avgPayDays: number;
  lastTrade: string | null;
  continuous: number;
}

export function LevelBadge({ level, size = "sm" }: { level: string; size?: "sm" | "lg" }) {
  const m = LEVEL_META[level] ?? LEVEL_META.unverified;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap"
      style={{ color: m.color, background: m.bg, fontSize: size === "lg" ? 13 : 11.5, padding: size === "lg" ? "5px 12px" : "3px 9px" }}
    >
      ◆ {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.active;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}

export function MiniStat({ n, label, red }: { n: number | string; label: string; red?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-black" style={{ color: red ? "#E5484D" : "#1657C9" }}>{n}</div>
      <div className="text-[10.5px] font-semibold text-(--color-brand-sub)">{label}</div>
    </div>
  );
}

export function SectionLabel({ text, right }: { text: string; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="h-3.5 w-1 rounded-full bg-(--color-brand-blue)" />
        <span className="text-[13.5px] font-bold text-(--color-brand-ink)">{text}</span>
      </div>
      {right}
    </div>
  );
}

export function VerifyBadges({ verify }: { verify: Record<string, string> }) {
  const shown = Object.keys(VERIFY_LABELS).filter((k) => verify?.[k] === "verified");
  if (shown.length === 0) return <span className="text-[12px] text-(--color-brand-faint)">確認済みの認証はありません</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-(--color-brand-green-soft) px-2 py-0.5 text-[11.5px] font-bold text-(--color-brand-green)">
          ✓ {VERIFY_LABELS[k].replace("確認", "")}
        </span>
      ))}
    </div>
  );
}

export function FactPanel({ concerns, positives }: { concerns: string[]; positives: string[] }) {
  return (
    <div>
      {concerns.length > 0 && (
        <div className="mb-2.5 rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3.5">
          <div className="mb-2 text-[13px] font-bold" style={{ color: "#9A6612" }}>確認事項</div>
          {concerns.map((f) => (
            <div key={f} className="mb-1 flex gap-1.5 text-[12.5px]" style={{ color: "#7A5410" }}><span>•</span>{f}</div>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-(--color-brand-green) bg-(--color-brand-green-soft) p-3.5">
        <div className="mb-2 text-[13px] font-bold text-(--color-brand-green)">確認済み情報</div>
        {positives.map((f) => (
          <div key={f} className="mb-1 flex gap-1.5 text-[12.5px]" style={{ color: "#0E6E48" }}><span>✓</span>{f}</div>
        ))}
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-(--color-brand-faint)">
        「安全」「危険」の断定はしません。確認できる事実を並べ、取引の判断はご自身で行ってください。
      </div>
    </div>
  );
}

function formatDate(s: string | null): string {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

export function PaymentMetrics({ m }: { m: MetricsView }) {
  const onTimeRate = m.onTimeCount + m.lateCount ? Math.round((m.onTimeCount / (m.onTimeCount + m.lateCount)) * 100) : null;
  const items: [string, string][] = [
    ["取引完了", `${m.completed}件`],
    ["支払い完了", `${m.paidCount}件`],
    ["期日内支払い", `${m.onTimeCount}件`],
    ["支払い遅延", `${m.lateCount}件`],
    ["期日内支払い率", onTimeRate === null ? "-" : `${onTimeRate}%`],
    ["平均支払日数", m.avgPayDays ? `${m.avgPayDays}日` : "-"],
    ["継続取引会社", `${m.continuous}社`],
    ["最終取引", formatDate(m.lastTrade)],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-brand-line) bg-white">
      {items.map(([k, v], i) => (
        <div key={k} className="flex justify-between px-3.5 py-2.5" style={{ borderBottom: i < items.length - 1 ? "1px solid var(--color-brand-line)" : "none" }}>
          <span className="text-[13px] font-semibold text-(--color-brand-sub)">{k}</span>
          <span className="text-[13.5px] font-bold" style={{ color: k === "支払い遅延" && m.lateCount > 0 ? "#E5484D" : "var(--color-brand-ink)" }}>{v}</span>
        </div>
      ))}
      <div className="bg-(--color-brand-bg) px-3.5 py-2 text-[10.5px] text-(--color-brand-faint)">取引データから自動集計。利用者は編集できません。</div>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-(--color-brand-line) py-2.5 last:border-0">
      <div className="w-24 shrink-0 text-[12.5px] font-semibold text-(--color-brand-sub)">{label}</div>
      <div className="text-[13px] font-semibold">{value || "-"}</div>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-(--color-brand-line) bg-white p-3.5 ${className ?? ""}`}>{children}</div>;
}
