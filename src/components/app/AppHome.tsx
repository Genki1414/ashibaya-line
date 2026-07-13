import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  unverified: { label: "未認証", color: "#6B7684", bg: "#EEF1F5" },
  bronze: { label: "Bronze", color: "#A9713B", bg: "#F6ECE1" },
  silver: { label: "Silver", color: "#6B7684", bg: "#EEF1F5" },
  gold: { label: "Gold", color: "var(--color-brand-gold)", bg: "#FBF2D9" },
  platinum: { label: "Platinum", color: "var(--color-brand-purple)", bg: "#EEE9FA" },
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "承認待ち", color: "var(--color-brand-amber)", bg: "var(--color-brand-amber-soft)" },
  active: { label: "取引可", color: "var(--color-brand-green)", bg: "var(--color-brand-green-soft)" },
  suspended: { label: "停止中", color: "var(--color-brand-red)", bg: "var(--color-brand-red-soft)" },
};

export interface CompanyListItem {
  id: string;
  name: string;
  region: string;
  level: string;
  status: string;
  completed: number;
  isSelf: boolean;
}

export interface AppHomeProps {
  email: string;
  self: {
    name: string;
    region: string;
    level: string;
    status: string;
    completed: number;
    onTimeCount: number;
    lateCount: number;
  } | null;
  companies: CompanyListItem[];
}

function LevelBadge({ level }: { level: string }) {
  const m = LEVEL_META[level] ?? LEVEL_META.unverified;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.active;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: m.color, background: m.bg }}>{m.label}</span>;
}

/** ログイン中の会社向けの接続版ホーム（実データ）。プロトタイプの見た目に沿った自社＋登録会社一覧。 */
export function AppHome({ email, self, companies }: AppHomeProps) {
  return (
    <div className="mx-auto min-h-dvh max-w-[460px] bg-(--color-brand-bg)">
      <header className="flex items-center gap-2 border-b border-(--color-brand-line) bg-(--color-brand-blue) px-4 py-3 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-[13px] font-black">足</span>
        <span className="text-[15px] font-bold">足場信用プラットフォーム</span>
        <form action={signOut} className="ml-auto">
          <button className="rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white">ログアウト</button>
        </form>
      </header>

      <div className="space-y-3 p-4">
        {/* 自社 */}
        <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4">
          <div className="text-[11.5px] font-bold text-(--color-brand-sub)">自社（{email}）</div>
          {self ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[18px] font-black text-(--color-brand-ink)">{self.name}</span>
                <LevelBadge level={self.level} />
                <StatusBadge status={self.status} />
              </div>
              <div className="mt-1 text-[12px] text-(--color-brand-sub)">{self.region || "地域未設定"}</div>
              <div className="mt-3 flex gap-4">
                <Stat n={self.completed} label="取引完了" />
                <Stat n={self.onTimeCount} label="期日内支払い" />
                <Stat n={self.lateCount} label="遅延" red={self.lateCount > 0} />
              </div>
              {self.status !== "active" && (
                <div className="mt-3 rounded-xl bg-(--color-brand-amber-soft) p-3 text-[12px] text-(--color-brand-sub)">
                  {self.status === "pending"
                    ? "本部の承認待ちです。プロフィール・認証書類の準備は今すぐ行えます。案件の発注・受注は承認後に解禁されます。"
                    : "利用が停止されています。本部管理者にお問い合わせください。"}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 text-[12px] text-(--color-brand-red)">会社に所属していません。</div>
          )}
        </div>

        {/* 登録会社一覧 */}
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-[13px] font-bold text-(--color-brand-sub)">登録会社一覧（{companies.length}）</span>
        </div>
        {companies.length === 0 && (
          <div className="rounded-2xl border border-(--color-brand-line) bg-white p-4 text-[13px] text-(--color-brand-sub)">
            まだ登録会社がありません。
          </div>
        )}
        {companies.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4" style={{ borderColor: c.isSelf ? "var(--color-brand-blue)" : "var(--color-brand-line)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-bold text-(--color-brand-ink)">{c.name}</span>
              {c.isSelf && <span className="rounded-full bg-(--color-brand-blue-light) px-2 py-0.5 text-[10.5px] font-bold text-(--color-brand-blue)">自社</span>}
              <LevelBadge level={c.level} />
              <StatusBadge status={c.status} />
              <span className="ml-auto text-[11.5px] text-(--color-brand-sub)">取引完了 {c.completed}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-(--color-brand-sub)">{c.region || "地域未設定"}</div>
          </div>
        ))}

        <div className="pt-4 text-center text-[11.5px] text-(--color-brand-faint)">
          案件・取引・チャット等の画面は順次このアプリに接続していきます。
          デザイン試作は <Link href="/preview" className="font-bold text-(--color-brand-blue)">/preview</Link>。
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, red }: { n: number; label: string; red?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-black" style={{ color: red ? "var(--color-brand-red)" : "var(--color-brand-blue)" }}>{n}</div>
      <div className="text-[10.5px] font-bold text-(--color-brand-sub)">{label}</div>
    </div>
  );
}
