import { useEffect, useState } from 'react';
import { formatMoney } from '@soul/ui';
import { toCents } from '@soul/money';
import { usePos, type CashMovement, type CashSessionSummary } from '../store/pos-store';
import { Overlay } from '../components/Overlay';
import { CloseCashDialog } from './CloseCashDialog';

const MOVEMENT_LABELS: Record<CashMovement['kind'], string> = {
  withdrawal: 'Sangria',
  supply: 'Suprimento',
  reinforcement: 'Reforço',
};

type Mode = 'menu' | 'withdrawal' | 'supply' | 'closing';

/**
 * Painel do caixa: sangria, suprimento e fechamento do turno.
 *
 * Tudo aqui fala com o servidor, então exige conexão — diferente da venda, que
 * acontece offline. É uma escolha: dinheiro contado precisa bater com o que o
 * servidor registrou, e não com uma cópia local que ainda pode mudar.
 */
export function CashDialog({ onClose }: { onClose: () => void }) {
  const { online, pendingCount, quarantinedCount, loadCashSummary } = usePos();
  const [mode, setMode] = useState<Mode>('menu');
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCashSummary().then(setSummary).catch(() => setError('Não foi possível carregar o caixa.'));
  }, [loadCashSummary]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && mode === 'menu') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  async function refresh() {
    setSummary(await loadCashSummary());
    setMode('menu');
  }

  if (mode === 'closing') {
    return <CloseCashDialog summary={summary} onCancel={() => setMode('menu')} onClosed={onClose} />;
  }

  if (mode === 'withdrawal' || mode === 'supply') {
    return <MovementForm kind={mode} onCancel={() => setMode('menu')} onSaved={refresh} />;
  }

  return (
    <Overlay>
      <h2 className="font-display text-xl font-bold text-indigo">Caixa</h2>
      {summary ? (
        <p className="mb-5 text-sm text-slate">
          Aberto às {formatHour(summary.openedAt)} por {summary.openedBy} · {summary.salesCount}{' '}
          {summary.salesCount === 1 ? 'venda' : 'vendas'} · fundo de {formatMoney(summary.openingFloatCents)}
        </p>
      ) : (
        <p className="mb-5 text-sm text-slate-soft">{error ?? 'Carregando...'}</p>
      )}

      {!online && (
        <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Sem conexão. Sangria e fechamento precisam do servidor — a venda continua funcionando.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={!online} onClick={() => setMode('withdrawal')}>
          Sangria
        </button>
        <button className="btn-ghost" disabled={!online} onClick={() => setMode('supply')}>
          Suprimento
        </button>
      </div>

      {summary && summary.movements.length > 0 && (
        <ul className="mt-4 divide-y divide-lavender-200 rounded-xl border border-lavender-200">
          {summary.movements.map((movement) => (
            <li key={movement.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-indigo">
                {MOVEMENT_LABELS[movement.kind]}
                <span className="ml-2 text-xs text-slate">{movement.reason}</span>
              </span>
              <span
                className={`font-mono tabular-nums ${movement.kind === 'withdrawal' ? 'text-danger' : 'text-success'}`}
              >
                {movement.kind === 'withdrawal' ? '−' : '+'}
                {formatMoney(movement.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        className="btn-primary mt-6 w-full"
        disabled={!online || !summary}
        onClick={() => setMode('closing')}
      >
        Fechar o caixa
      </button>
      {pendingCount > 0 && (
        <p className="mt-2 text-center font-mono text-xs text-magenta">
          {pendingCount} venda(s) ainda não sincronizada(s) — o fechamento será recusado até subirem
        </p>
      )}
      {/* Recusada não sobe sozinha. Fechar o turno sem resolver é fechar com a
          gaveta batendo diferente do sistema — o aviso precisa ser explícito. */}
      {quarantinedCount > 0 && (
        <p className="mt-2 rounded-card bg-red-50 px-3 py-2 text-center font-mono text-xs text-red-700">
          {quarantinedCount} venda(s) recusada(s) pelo servidor e que não vão subir sozinhas.
          Chame a retaguarda antes de fechar: elas não entraram no faturamento nem geraram nota.
        </p>
      )}

      <button className="mt-3 w-full text-xs text-slate hover:text-indigo" onClick={onClose}>
        Voltar à venda (ESC)
      </button>
    </Overlay>
  );
}

function MovementForm({
  kind,
  onCancel,
  onSaved,
}: {
  kind: 'withdrawal' | 'supply';
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const registerCashMovement = usePos((state) => state.registerCashMovement);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = safeCents(amount);
  const valid = cents > 0 && reason.trim().length >= 3;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerCashMovement({ kind, amountCents: cents, reason: reason.trim() });
      await onSaved();
    } catch {
      setError('Não foi possível registrar. Verifique a conexão.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay>
      <form onSubmit={submit}>
        <h2 className="mb-1 font-display text-xl font-bold text-indigo">{MOVEMENT_LABELS[kind]}</h2>
        <p className="mb-5 text-sm text-slate">
          {kind === 'withdrawal'
            ? 'Retirada de dinheiro da gaveta. A gaveta abre ao confirmar.'
            : 'Entrada de dinheiro na gaveta, como troco extra.'}
        </p>

        <label className="label" htmlFor="amount">Valor</label>
        <input
          id="amount"
          className="field text-2xl font-semibold tabular-nums"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
        />
        <p className="mt-1 font-mono text-xs text-slate">{formatMoney(cents)}</p>

        <label className="label mt-4" htmlFor="reason">Motivo</label>
        <input
          id="reason"
          className="field"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={kind === 'withdrawal' ? 'Depósito no cofre' : 'Troco do gerente'}
        />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
            Voltar
          </button>
          <button className="btn-primary flex-1" disabled={!valid || busy}>
            {busy ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function safeCents(value: string): number {
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
