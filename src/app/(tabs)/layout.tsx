import type { ReactNode } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/BottomNav";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return <PhoneFrame bottomNav={<BottomNav />}>{children}</PhoneFrame>;
}
