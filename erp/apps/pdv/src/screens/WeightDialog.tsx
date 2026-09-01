import { useEffect, useState } from 'react';
import { formatMoney } from '@soul/ui';
import { multiplyByQuantity } from '@soul/money';
import { readScale } from '../lib/scale';
import type { CachedCatalogItem } from '../lib/db';

/**
 * Peso digitado à mão. Só aparece quando a balança não respondeu — a leitura
 * automática é a regra, e a digitação é a exceção que fica registrada na venda.
 */
export function WeightDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: CachedCatalogItem;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const [grams, setGrams] = useState('');
  const [retrying, setRetrying] = useState(false);

  const quantity = Number(grams.replace(',', '.')) / 1000;
  const valid = Number.isFinite(quantity) && quantity > 0;
  const totalCents = valid ? multiplyByQuantity(item.priceCents, quantity) : 0;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function retryScale() {
    setRetrying(true);
    const reading = await readScale();
    setRetrying(false);
    if (reading?.stable && reading.weightKg > 0) onConfirm(reading.weightKg);
  }

  return (
    <Overlay>
      <h2 className="font-display text-xl font-bold text-indigo">{item.description}</h2>
      <p className="mb-4 text-sm text-slate">
        {formatMoney(item.priceCents)} por quilo — a balança não respondeu.
      </p>

      <label className="label" htmlFor="grams">
        Peso em gramas
      </label>
      <input
        id="grams"
        className="field text-3xl font-semibold tabular-nums"
        value={grams}
        onChange={(event) => setGrams(event.target.value)}
        inputMode="numeric"
        placeholder="412"
        autoFocus
      />

      <p className="mt-3 font-display text-2xl font-bold tabular-nums text-violet">
        {formatMoney(totalCents)}
      </p>

      <div className="mt-6 flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => void retryScale()} disabled={retrying}>
          {retrying ? 'Lendo...' : 'Tentar a balança'}
        </button>
        <button className="btn-primary flex-1" disabled={!valid} onClick={() => onConfirm(quantity)}>
          Adicionar
        </button>
      </div>
      <button className="mt-3 w-full text-xs text-slate hover:text-indigo" onClick={onCancel}>
        Cancelar (ESC)
      </button>
    </Overlay>
  );
}

export function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-lifted">{children}</div>
    </div>
  );
}
