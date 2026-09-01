import { useState } from 'react';
import { formatMoney } from '@soul/ui';
import { toCents } from '@soul/money';
import { usePos } from '../store/pos-store';

/** Sem caixa aberto não se vende — é o que torna o fechamento conferível. */
export function OpenCashScreen() {
  const { operator, openCashSession } = usePos();
  const [amount, setAmount] = useState('100,00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = safeCents(amount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await openCashSession(cents);
    } catch {
      setError('Não foi possível abrir o caixa. Verifique a conexão.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8">
        <h1 className="mb-1 font-display text-2xl font-bold text-indigo">Abrir o caixa</h1>
        <p className="mb-6 text-sm text-slate">
          Operador: <strong className="text-indigo">{operator?.name}</strong>
        </p>

        <label className="label" htmlFor="float">
          Fundo de troco
        </label>
        <input
          id="float"
          className="field text-2xl font-semibold tabular-nums"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          autoFocus
        />
        <p className="mt-2 font-mono text-xs text-slate">{formatMoney(cents)} em gaveta</p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Abrindo...' : 'Abrir caixa e começar'}
        </button>
      </form>
    </div>
  );
}

function safeCents(value: string): number {
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}
