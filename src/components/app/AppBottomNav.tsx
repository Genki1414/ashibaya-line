"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "ホーム", icon: "⌂" },
  { href: "/projects", label: "案件", icon: "▤" },
  { href: "/transactions", label: "取引", icon: "⇄" },
  { href: "/partners", label: "パートナー", icon: "◈" },
  { href: "/me", label: "自社", icon: "◎" },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[460px] -translate-x-1/2 border-t border-(--color-brand-line) bg-white px-1 pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
            style={{ color: active ? "var(--color-brand-blue)" : "var(--color-brand-faint)" }}
          >
            <span className="text-[18px] leading-none">{t.icon}</span>
            <span className="whitespace-nowrap text-[10px] leading-none" style={{ fontWeight: active ? 800 : 600 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
