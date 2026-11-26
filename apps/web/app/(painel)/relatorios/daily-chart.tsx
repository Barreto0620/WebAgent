const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function DailyChart({ data }: { data: { key: string; opened: number; resolved: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.opened, d.resolved)));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const W = 760;
  const H = 220;
  const padL = 30;
  const padB = 24;
  const innerW = W - padL - 8;
  const innerH = H - padB - 10;
  const slot = innerW / data.length;
  const bar = Math.max(2, Math.min(18, slot * 0.6));
  const y = (v: number) => 10 + innerH - (v / nice) * innerH;
  const every = Math.ceil(data.length / 10);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${padL + i * slot + slot / 2},${y(d.resolved)}`).join(" ");
  const total = data.reduce((a, d) => a + d.opened, 0);

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full min-w-[560px]" role="img" aria-label={`${total} conversas abertas no período`}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y(nice * t)} y2={y(nice * t)} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
              <text x={padL - 6} y={y(nice * t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(nice * t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = padL + i * slot + slot / 2;
            return (
              <g key={d.key}>
                <rect x={x - bar / 2} y={y(d.opened)} width={bar} height={10 + innerH - y(d.opened)} rx={2} fill="var(--primary)" opacity={0.85}>
                  <title>{`${fmt.format(new Date(`${d.key}T00:00:00Z`))}: ${d.opened} abertas, ${d.resolved} resolvidas`}</title>
                </rect>
                {i % every === 0 && (
                  <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{fmt.format(new Date(`${d.key}T00:00:00Z`))}</text>
                )}
              </g>
            );
          })}
          <path d={line} fill="none" stroke="var(--gold)" strokeWidth={2} strokeLinejoin="round" />
          {data.length > 0 && <circle cx={padL + (data.length - 1) * slot + slot / 2} cy={y(data.at(-1)!.resolved)} r={3.5} fill="var(--gold)" />}
        </svg>
      </div>
      <figcaption className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> Abertas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-gold" /> Resolvidas</span>
      </figcaption>
    </figure>
  );
}
