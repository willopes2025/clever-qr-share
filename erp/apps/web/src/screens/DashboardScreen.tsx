import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import { api, session, type HourSlot, type LivePerformance, type MixEntry, type TerminalHealth as Terminal } from '../lib/api';
import { KpiTile } from '../components/KpiTile';
import { StoreBars } from '../components/StoreBars';
import { HourlyCurve } from '../components/HourlyCurve';
import { MixList } from '../components/MixList';
import { TerminalHealth } from '../components/TerminalHealth';
import { FiscalPanel } from '../components/FiscalPanel';
import { SoulLogo } from '../components/SoulLogo';

const LIVE_REFRESH_MS = 30_000;

/** Painel que o dono deixa aberto: números do dia, movimento, mix e saúde da operação. */
export function DashboardScreen({ onSignOut }: { onSignOut: () => void }) {
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
    <div className="min-h-screen bg-lavender">
      <header className="flex items-center gap-4 bg-indigo px-6 py-4 text-white">
        <SoulLogo className="h-7 text-white" />
        <div className="ml-2 border-l border-white/20 pl-4">
          <p className="font-display text-sm font-semibold">Retaguarda</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-lavender-400">
            desempenho da rede
          </p>
        </div>
        <button
          onClick={() => {
            session.clear();
            onSignOut();
          }}
          className="ml-auto rounded-pill border border-white/25 px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:bg-white/10"
        >
          sair
        </button>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-6">
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
      </main>
    </div>
  );
}
