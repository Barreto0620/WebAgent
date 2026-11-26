import { cn } from "@/lib/utils";

export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

/** Esqueleto genérico de página: cabeçalho, indicadores e blocos. Aparece no mesmo instante do clique. */
export function PageSkeleton({ kpis = 4, blocks = 2 }: { kpis?: number; blocks?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
              <Bone className="h-3 w-24" />
              <Bone className="h-7 w-16" />
              <Bone className="h-3 w-28" />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <Bone className="h-4 w-40" />
            <Bone className="h-32 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="-mx-4 -mt-5 -mb-28 flex h-[calc(100dvh-3.5rem-4.25rem)] sm:-mx-6 lg:-mb-10 lg:h-[calc(100dvh-3.5rem)]" aria-busy="true" aria-label="Carregando conversas">
      <div className="flex w-full flex-col border-r border-line md:w-[340px]">
        <div className="flex flex-col gap-3 border-b border-line p-3">
          <Bone className="h-9 w-full" />
          <Bone className="h-8 w-full" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-3 border-b border-line px-4 py-3">
            <Bone className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-1/2" />
              <Bone className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-1 md:block" />
    </div>
  );
}
