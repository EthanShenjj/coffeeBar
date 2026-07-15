import { BottomNav } from "@/components/bottom-nav";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return <><div className="min-h-screen pb-24 md:pb-10">{children}</div><BottomNav /></>;
}
