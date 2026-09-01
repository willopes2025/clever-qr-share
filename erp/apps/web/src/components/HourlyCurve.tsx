import { useState } from 'react';
import { formatMoney } from '@soul/ui';
import { DATA_SERIES, niceMax } from '../lib/charts';
import type { HourSlot } from '../lib/api';

const WIDTH = 640;
const HEIGHT = 210;
const PADDING = { top: 12, right: 12, bottom: 28, left: 46 };

/**
 * Curva do dia típico: quanto o quiosque fatura, em média, em cada faixa de 30
 * minutos. É o número que decide escala de gente e reposição — por isso a média
 * diária, e não o acumulado do período.
 */
export function HourlyCurve({ slots }: { slots: HourSlot[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (slots.length === 0) {
    return (
      <figure className="card p-5">
        <h2 className="font-display text-base font-semibold text-indigo">Curva do dia</h2>
        <p className="mt-6 text-center text-sm text-slate-soft">Sem vendas no período.</p>
      </figure>
    );
  }

  const max = niceMax(slots.map((slot) => slot.avgRevenueCents));
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const step = plotWidth / Math.max(slots.length - 1, 1);

  const x = (index: number) => PADDING.left + index * step;
  const y = (value: number) => PADDING.top + plotHeight - (value / max) * plotHeight;

  const line = slots
    .map((slot, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(slot.avgRevenueCents)}`)
    .join(' ');
  const area = `${line} L ${x(slots.length - 1)} ${PADDING.top + plotHeight} L ${PADDING.left} ${PADDING.top + plotHeight} Z`;
  const peak = slots.reduce((best, slot) => (slot.avgRevenueCents > best.avgRevenueCents ? slot : best), slots[0]!);
  const current = active !== null ? slots[active] : null;
  const labelEvery = Math.ceil(slots.length / 7);

  return (
    <figure className="card p-5">
      <figcaption className="mb-3">
        <h2 className="font-display text-base font-semibold text-indigo">Curva do dia</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate">
          média por faixa de 30 min · últimos 7 dias
        </p>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Faturamento médio por faixa de horário"
        onMouseLeave={() => setActive(null)}
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(max * ratio)}
              y2={y(max * ratio)}
              stroke="#EAE2FF"
              strokeWidth="1"
            />
            <text x="0" y={y(max * ratio) + 4} className="fill-slate font-mono text-[10px]">
              {formatMoney(max * ratio).replace('R$', '').trim()}
            </text>
          </g>
        ))}

        <path d={area} fill={DATA_SERIES[0]} opacity="0.10" />
        <path d={line} fill="none" stroke={DATA_SERIES[0]} strokeWidth="2" strokeLinejoin="round" />

        {/* Pico do dia rotulado direto no gráfico: é o dado que se procura aqui. */}
        <circle cx={x(slots.indexOf(peak))} cy={y(peak.avgRevenueCents)} r="4" fill={DATA_SERIES[0]} />
        <text
          x={x(slots.indexOf(peak))}
          y={y(peak.avgRevenueCents) - 10}
          textAnchor="middle"
          className="fill-indigo font-mono text-[10px] font-semibold"
        >
          pico {peak.slot}
        </text>

        {slots.map((slot, index) => (
          <g key={slot.slot}>
            <rect
              x={x(index) - step / 2}
              y={PADDING.top}
              width={step}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
            />
            {active === index && (
              <>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={PADDING.top}
                  y2={PADDING.top + plotHeight}
                  stroke="#C9BCF0"
                  strokeWidth="1"
                />
                <circle
                  cx={x(index)}
                  cy={y(slot.avgRevenueCents)}
                  r="5"
                  fill={DATA_SERIES[0]}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </>
            )}
          </g>
        ))}

        {slots.map((slot, index) =>
          index % labelEvery === 0 ? (
            <text
              key={slot.slot}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-slate font-mono text-[10px]"
            >
              {slot.slot}
            </text>
          ) : null,
        )}
      </svg>

      <p className="mt-2 h-5 font-mono text-xs text-indigo">
        {current
          ? `${current.slot} · média ${formatMoney(current.avgRevenueCents)} · ${current.salesCount} vendas no período`
          : `pico às ${peak.slot} com média de ${formatMoney(peak.avgRevenueCents)}`}
      </p>
    </figure>
  );
}
