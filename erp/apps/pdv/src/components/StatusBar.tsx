import { usePos } from '../store/pos-store';
import { SoulLogo } from './SoulLogo';

/**
 * Barra de estado do terminal. Offline não é tela de erro — é um selo discreto,
 * porque o caixa precisa continuar vendendo sem se assustar.
 */
export function StatusBar() {
  const { bootstrap, operator, online, pendingCount, devices } = usePos();

  return (
    <header className="flex items-center gap-4 bg-indigo px-5 py-3 text-white">
      <SoulLogo className="h-7 text-white" />

      <div className="ml-2 border-l border-white/20 pl-4">
        <p className="font-display text-sm font-semibold leading-tight">
          {bootstrap?.store.name ?? 'Terminal não pareado'}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-lavender-400">
          {bootstrap?.terminal.code ?? '—'} · {operator?.name ?? 'sem operador'}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge tone={online ? 'ok' : 'warn'} label={online ? 'online' : 'offline'} />
        {pendingCount > 0 && <Badge tone="warn" label={`${pendingCount} na fila`} />}
        <DeviceBadge label="impressora" ok={devices.printerOk} />
        <DeviceBadge label="balança" ok={devices.scaleOk} />
      </div>
    </header>
  );
}

function Badge({ tone, label }: { tone: 'ok' | 'warn' | 'off'; label: string }) {
  const tones = {
    ok: 'bg-white/15 text-white',
    warn: 'bg-pink/20 text-pink',
    off: 'bg-white/10 text-lavender-400',
  } as const;

  return (
    <span className={`rounded-pill px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${tones[tone]}`}>
      {label}
    </span>
  );
}

function DeviceBadge({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) return <Badge tone="off" label={`${label} ?`} />;
  return <Badge tone={ok ? 'ok' : 'warn'} label={ok ? label : `${label} fora`} />;
}
