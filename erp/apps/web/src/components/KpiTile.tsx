/** Número-herói: a resposta antes do detalhe. */
export function KpiTile({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { percent: number | null; caption: string };
}) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums text-indigo">{value}</p>
      {hint && <p className="mt-1 font-mono text-xs text-slate">{hint}</p>}
      {trend && trend.percent !== null && (
        <p
          className={`mt-2 font-mono text-xs ${trend.percent >= 0 ? 'text-success' : 'text-danger'}`}
        >
          {trend.percent >= 0 ? '▲' : '▼'} {Math.abs(trend.percent).toFixed(1)}% {trend.caption}
        </p>
      )}
    </div>
  );
}
