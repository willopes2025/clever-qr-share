import { formatMoney } from '@soul/ui';
import { DATA_SERIES } from '../lib/charts';
import type { MixEntry } from '../lib/api';

/** Mix de produtos: barra proporcional dentro da própria linha, sem eixo. */
export function MixList({ entries }: { entries: MixEntry[] }) {
  const top = entries.slice(0, 8);
  const max = Math.max(1, ...top.map((entry) => entry.revenueCents));

  return (
    <figure className="card p-5">
      <figcaption className="mb-4">
        <h2 className="font-display text-base font-semibold text-indigo">Mais vendidos</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate">últimos 7 dias</p>
      </figcaption>

      <ul className="space-y-3">
        {top.map((entry) => (
          <li key={entry.skuId}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-indigo">{entry.description}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-slate">
                {formatMoney(entry.revenueCents)} · {entry.sharePercent}%
              </span>
            </div>
            <div className="h-2 rounded-pill bg-lavender-200">
              <div
                className="h-2 rounded-pill"
                style={{
                  width: `${Math.max((entry.revenueCents / max) * 100, 2)}%`,
                  backgroundColor: DATA_SERIES[0],
                }}
              />
            </div>
          </li>
        ))}
        {top.length === 0 && <li className="text-sm text-slate-soft">Sem vendas no período.</li>}
      </ul>
    </figure>
  );
}
