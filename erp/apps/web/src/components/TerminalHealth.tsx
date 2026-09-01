import { formatRelative } from '@soul/ui';
import type { TerminalHealth as Terminal } from '../lib/api';

type Tone = 'good' | 'warning' | 'critical';

/**
 * Saúde dos terminais. Estado nunca é só cor: cada cartão traz o rótulo escrito,
 * porque o dono lê isso no celular, às vezes no sol.
 */
export function TerminalHealth({ terminals }: { terminals: Terminal[] }) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h2 className="font-display text-base font-semibold text-indigo">Terminais</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate">
          {terminals.filter((terminal) => terminal.online).length} de {terminals.length} online
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {terminals.map((terminal) => {
          const state = describe(terminal);
          return (
            <li key={terminal.id} className="rounded-xl border border-lavender-200 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-indigo">{terminal.store}</span>
                <StatusChip tone={state.tone} label={state.label} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-slate">
                <Row label="terminal" value={terminal.code} />
                <Row label="visto" value={formatRelative(terminal.lastSeenAt)} />
                <Row label="fila de venda" value={String(terminal.pendingSales)} />
                <Row label="fila fiscal" value={String(terminal.fiscalQueue)} />
                <Row label="impressora" value={deviceLabel(terminal.printerOk)} />
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-soft">{label}</dt>
      <dd className="text-right text-indigo">{value}</dd>
    </>
  );
}

function StatusChip({ tone, label }: { tone: Tone; label: string }) {
  const styles: Record<Tone, string> = {
    good: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    critical: 'bg-danger-soft text-danger',
  };
  const icons: Record<Tone, string> = { good: '●', warning: '▲', critical: '■' };

  return (
    <span className={`rounded-pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${styles[tone]}`}>
      {icons[tone]} {label}
    </span>
  );
}

function describe(terminal: Terminal): { tone: Tone; label: string } {
  if (!terminal.online) return { tone: 'critical', label: 'offline' };
  if (terminal.pendingSales > 0) return { tone: 'critical', label: 'venda na fila' };
  if (terminal.fiscalQueue > 5) return { tone: 'warning', label: 'nota atrasada' };
  if (terminal.printerOk === false) return { tone: 'warning', label: 'impressora fora' };
  return { tone: 'good', label: 'ok' };
}

function deviceLabel(state: boolean | null): string {
  if (state === null) return 'sem dado';
  return state ? 'ok' : 'fora';
}
