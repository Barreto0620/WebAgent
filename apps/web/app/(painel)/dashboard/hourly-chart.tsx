/** Barras por hora (recebidas × enviadas). SVG puro, cores do tema. */
export function HourlyChart({ data, currentHour }: { data: { hour: number; in: number; out: number }[]; currentHour: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const W = 720;
  const H = 200;
  const padL = 28;
  const padB = 22;
  const innerW = W - padL - 6;
  const innerH = H - padB - 8;
  const slot = innerW / 24;
  const bar = Math.max(3, slot / 2 - 2);
  const y = (v: number) => 8 + innerH - (v / nice) * innerH;
  const total = data.reduce((a, d) => a + d.in + d.out, 0);

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full min-w-[520px]" role="img" aria-label={`Mensagens por hora hoje: ${total} no total`}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 6} y1={y(nice * t)} y2={y(nice * t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={padL - 6} y={y(nice * t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular">
                {Math.round(nice * t)}
              </text>
            </g>
          ))}
          {data.map((d) => {
            const x = padL + d.hour * slot + slot / 2;
            const future = d.hour > currentHour;
            return (
              <g key={d.hour} opacity={future ? 0.35 : 1}>
                <rect x={x - bar - 1} y={y(d.in)} width={bar} height={innerH + 8 - y(d.in)} rx={2} fill="var(--primary)">
                  <title>{`${d.hour}h · ${d.in} recebidas`}</title>
                </rect>
                <rect x={x + 1} y={y(d.out)} width={bar} height={innerH + 8 - y(d.out)} rx={2} fill="var(--gold)">
                  <title>{`${d.hour}h · ${d.out} enviadas`}</title>
                </rect>
                {d.hour % 3 === 0 && (
                  <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                    {String(d.hour).padStart(2, "0")}h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> Recebidas</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gold" /> Enviadas</span>
      </figcaption>
    </figure>
  );
}
