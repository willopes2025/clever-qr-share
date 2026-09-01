import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import { api, type HourSlot, type LivePerformance, type MixEntry, type TerminalHealth as Terminal } from '../lib/api';
import { KpiTile } from '../components/KpiTile';
import { StoreBars } from '../components/StoreBars';
import { HourlyCurve } from '../components/HourlyCurve';
import { MixList } from '../components/MixList';
import { TerminalHealth } from '../components/TerminalHealth';
import { FiscalPanel } from '../components/FiscalPanel';

const LIVE_REFRESH_MS = 30_000;

/** Painel que o dono deixa aberto: números do dia, movimento, mix e saúde da operação. */
export function DashboardScreen() {
  const live = useQuery({
    queryKey: ['live'],
    queryFn: () => api<LivePerformance>('/analytics/live'),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const hourly = useQuery({ queryKey: ['hourly'], queryFn: () => api<HourSlot[]>('/analytics/hourly') });
  const mix = useQuery({ queryKey: ['mix'], queryFn: () => api<MixEntry[]>('/analytics/mix') });
  const terminals = useQuery({
    queryKey: ['terminals'],
    queryFn: () => api<Terminal[]>('/telemetry/terminals'),
    refetchInterval: LIVE_REFRESH_MS,
  });
  const fiscal = useQuery({
    queryKey: ['fiscal'],
    queryFn: () => api<Record<string, number>>('/fiscal/summary'),
    refetchInterval: LIVE_REFRESH_MS,
  });

  const performance = live.data;

  return (
    <div className="space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Faturamento hoje"
            value={performance ? formatMoney(performance.revenueCents) : '—'}
            trend={
              performance
                ? {
                    percent: performance.comparedToLastWeek.variationPercent,
                    caption: 'vs. mesmo dia da semana passada',
                  }
                : undefined
            }
          />
          <KpiTile label="Vendas" value={performance ? String(performance.salesCount) : '—'} />
          <KpiTile
            label="Ticket médio"
            value={performance ? formatMoney(performance.avgTicketCents) : '—'}
          />
          <KpiTile
            label="Quiosques vendendo"
            value={
              performance
                ? String(performance.byStore.filter((store) => store.salesCount > 0).length)
                : '—'
            }
            hint={performance ? `de ${performance.byStore.length} unidades` : undefined}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {performance && <StoreBars stores={performance.byStore} />}
          <HourlyCurve slots={hourly.data ?? []} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <MixList entries={mix.data ?? []} />
          <FiscalPanel summary={fiscal.data ?? {}} />
        </section>

      <TerminalHealth terminals={terminals.data ?? []} />
    </div>
  );
}
