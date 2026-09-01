import { useState } from 'react';
import { formatMoney } from '@soul/ui';
import { DATA_SERIES, niceMax } from '../lib/charts';
import type { LivePerformance } from '../lib/api';

const ROW_HEIGHT = 46;
const BAR_HEIGHT = 18;
const LABEL_WIDTH = 168;

/**
 * Faturamento por quiosque. Série única, então uma cor só e rótulo direto em
 * cada barra — legenda seria ruído.
 */
export function StoreBars({ stores }: { stores: LivePerformance['byStore'] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = niceMax(stores.map((store) => store.revenueCents));
  const height = Math.max(stores.length * ROW_HEIGHT, ROW_HEIGHT);

  return (
    <figure className="card p-5">
      <figcaption className="mb-4">
        <h2 className="font-display text-base font-semibold text-indigo">Faturamento por quiosque</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate">hoje</p>
      </figcaption>

      <svg viewBox={`0 0 640 ${height}`} className="w-full" role="img" aria-label="Faturamento por quiosque hoje">
        {stores.map((store, index) => {
          const y = index * ROW_HEIGHT;
          const width = (store.revenueCents / max) * (640 - LABEL_WIDTH - 90);
          const active = hovered === store.storeId;

          return (
            <g
              key={store.storeId}
              onMouseEnter={() => setHovered(store.storeId)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x="0" y={y} width="640" height={ROW_HEIGHT} fill="transparent" />
              <text x="0" y={y + 20} className="fill-indigo font-sans text-[13px]">
                {store.storeName}
              </text>
              <text x="0" y={y + 36} className="fill-slate font-mono text-[10px]">
                {store.salesCount} vendas · ticket {formatMoney(store.avgTicketCents)}
              </text>
              <rect
                x={LABEL_WIDTH}
                y={y + 10}
                width={Math.max(width, 2)}
                height={BAR_HEIGHT}
                rx="4"
                fill={DATA_SERIES[0]}
                opacity={active ? 1 : 0.88}
              />
              <text
                x={LABEL_WIDTH + Math.max(width, 2) + 10}
                y={y + 24}
                className="fill-indigo font-mono text-[12px] font-semibold"
              >
                {formatMoney(store.revenueCents)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
