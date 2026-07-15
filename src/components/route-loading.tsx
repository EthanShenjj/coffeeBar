import { AppFrame } from "@/components/app-frame";

export function RouteLoading({ compact = false }: { compact?: boolean }) {
  return (
    <AppFrame>
      <div aria-busy="true" aria-label="页面加载中" className="motion-safe:animate-pulse">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <div className="h-5 w-28 rounded-full bg-zinc-200" />
            <div className="flex items-center gap-2">
              <div className="h-11 w-24 rounded-full bg-zinc-200" />
              <div className="size-11 rounded-full bg-zinc-300" />
            </div>
          </div>
        </header>
        <main className={compact ? "mx-auto max-w-3xl px-5 py-9" : "mx-auto max-w-6xl px-5 py-8 md:py-12"}>
          <div className="h-3 w-28 rounded-full bg-zinc-200" />
          <div className="mt-4 h-11 w-3/5 max-w-md rounded-2xl bg-zinc-200" />
          <div className="mt-3 h-4 w-2/5 max-w-xs rounded-full bg-zinc-200" />
          <div className="mt-9 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-10 w-24 shrink-0 rounded-full bg-zinc-200" />)}
          </div>
          <div className={compact ? "mt-7 space-y-3" : "mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className={compact ? "h-24 rounded-[1.5rem] border bg-white" : "aspect-[4/4.5] rounded-[1.5rem] border bg-white"}>
                <div className={compact ? "m-4 size-16 rounded-2xl bg-zinc-100" : "m-3 h-3/5 rounded-[1rem] bg-zinc-100"} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </AppFrame>
  );
}
