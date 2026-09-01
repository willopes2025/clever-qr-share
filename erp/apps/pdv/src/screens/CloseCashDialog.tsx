import { useState } from 'react';
import { formatMoney } from '@soul/ui';
import { toCents } from '@soul/money';
import { usePos, type CashClosingResult, type CashSessionSummary } from '../store/pos-store';
import { Overlay } from '../components/Overlay';

/** Os meios que o operador confere na gaveta e nos comprovantes da maquineta. */
const METHODS = [
  { key: 'cash', label: 'Dinheiro', hint: 'conte as cédulas e moedas' },
  { key: 'debit', label: 'Débito', hint: 'some os comprovantes' },
  { key: 'credit', label: 'Crédito', hint: 'some os comprovantes' },
  { key: 'pix', label: 'Pix', hint: 'confira no aplicativo' },
] as const;

/**
 * Fechamento por conferência cega: o operador digita o que contou **sem ver** o
 * que o sistema espera. Só depois de enviar é que a diferença aparece — é o que
 * torna a conferência uma conferência, e não uma cópia.
 */
export function CloseCashDialog({
  summary,
  onCancel,
  onClosed,
}: {
  summary: CashSessionSummary | null;
  onCancel: () => void;
  onClosed: () => void;
}) {
  const { closeCashSession, finishShift } = usePos();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<CashClosingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (result) {
    return (
      <ClosingResult
        result={result}
        onDone={() => {
          finishShift();
          onClosed();
        }}
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const amounts = Object.fromEntries(
        METHODS.map((method) => [method.key, safeCents(counted[method.key] ?? '')]),
      );
      setResult(await closeCashSession(amounts, notes.trim() || undefined));
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay>
      <form onSubmit={submit}>
        <h2 className="font-display text-xl font-bold text-indigo">Fechar o caixa</h2>
        <p className="mb-5 text-sm text-slate">
          Conte o que está na gaveta e nos comprovantes. O sistema só mostra a diferença depois —
          {summary ? ` ${summary.salesCount} vendas no turno.` : ''}
        </p>

        <div className="space-y-3">
          {METHODS.map((method) => (
            <div key={method.key} className="flex items-center gap-3">
              <div className="flex-1">
                <span className="block font-display text-sm font-semibold text-indigo">{method.label}</span>
                <span className="font-mono text-[11px] text-slate">{method.hint}</span>
              </div>
              <input
                className="field w-36 text-right tabular-nums"
                value={counted[method.key] ?? ''}
                onChange={(event) => setCounted({ ...counted, [method.key]: event.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                aria-label={`Valor contado em ${method.label}`}
              />
            </div>
          ))}
        </div>

        <label className="label mt-5" htmlFor="notes">
          Observação (obrigatória se houver diferença)
        </label>
        <input
          id="notes"
          className="field"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="o que explica a sobra ou a falta"
        />

        {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
            Voltar
          </button>
          <button className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Fechando...' : 'Conferir e fechar'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function ClosingResult({ result, onDone }: { result: CashClosingResult; onDone: () => void }) {
  const closed = result.differenceCents === 0;

  return (
    <Overlay>
      <h2 className="font-display text-xl font-bold text-indigo">Caixa fechado</h2>
      <p className="mb-4 text-sm text-slate">O relatório foi enviado para a impressora.</p>

      <table className="w-full text-sm">
        <thead className="font-mono text-[10px] uppercase tracking-widest text-slate">
          <tr>
            <th className="pb-1 text-left">Meio</th>
            <th className="pb-1 text-right">Esperado</th>
            <th className="pb-1 text-right">Contado</th>
            <th className="pb-1 text-right">Dif.</th>
          </tr>
        </thead>
        <tbody>
          {methodsOf(result).map((method) => {
            const difference = result.differenceByMethod[method] ?? 0;
            return (
              <tr key={method} className="border-t border-lavender-200">
                <td className="py-2 text-indigo">{METHOD_LABELS[method] ?? method}</td>
                <td className="py-2 text-right font-mono tabular-nums text-slate">
                  {formatMoney(result.expected[method] ?? 0)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-indigo">
                  {formatMoney(result.counted[method] ?? 0)}
                </td>
                <td
                  className={`py-2 text-right font-mono tabular-nums ${difference === 0 ? 'text-slate' : 'text-danger'}`}
                >
                  {formatMoney(difference)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        className={`mt-4 rounded-xl px-4 py-3 text-center ${closed ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
      >
        <span className="font-mono text-[11px] uppercase tracking-widest">Diferença do turno</span>
        <p className="font-display text-2xl font-bold tabular-nums">{formatMoney(result.differenceCents)}</p>
      </div>

      <button className="btn-primary mt-6 w-full" onClick={onDone}>
        Encerrar turno
      </button>
    </Overlay>
  );
}

/** Mostra todo meio que o sistema esperava ou que o operador contou. */
function methodsOf(result: CashClosingResult): string[] {
  return [...new Set([...Object.keys(result.expected), ...Object.keys(result.counted)])];
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit: 'Crédito',
  pix: 'Pix',
  voucher: 'Voucher',
  store_credit: 'Crédito do cliente',
};

function safeCents(value: string): number {
  try {
    return toCents(value);
  } catch {
    return 0;
  }
}

/** Traduz o código do servidor em instrução para quem está no caixa. */
function describe(failure: unknown): string {
  const code = (failure as { code?: string })?.code;
  if (code === 'PENDING_SALES') {
    return 'Existem vendas ainda não sincronizadas. Aguarde a fila subir antes de fechar.';
  }
  if (code === 'JUSTIFICATION_REQUIRED') {
    return 'A contagem não bateu com o esperado. Escreva o que explica a diferença.';
  }
  if (code === 'CASH_SESSION_CLOSED') return 'Este caixa já foi fechado.';
  return 'Não foi possível fechar o caixa. Verifique a conexão.';
}
