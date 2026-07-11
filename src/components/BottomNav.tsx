"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/projects", label: "案件", icon: "📋" },
  { href: "/transactions", label: "取引", icon: "🤝" },
  { href: "/partners", label: "パートナー", icon: "🧰" },
  { href: "/me", label: "自社", icon: "🏢" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 border-t border-(--color-brand-line) bg-white">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold"
            style={{
              color: active ? "var(--color-brand-blue)" : "var(--color-brand-faint)",
            }}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
