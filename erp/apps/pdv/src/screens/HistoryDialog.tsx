import { useEffect, useState } from 'react';
import { formatMoney } from '@soul/ui';
import { usePos } from '../store/pos-store';
import { listQuarantined, type RecentSale } from '../lib/db';

/**
 * Últimas vendas do terminal.
 *
 * Duas coisas que o balcão precisa e não tinha. Reimprimir, porque impressora
 * trava e cliente pede segunda via — e a impressora é local, então isso tem que
 * funcionar mesmo sem rede. E resolver a venda que o servidor recusou, que
 * antes aparecia em vermelho sem nada para fazer a respeito.
 */
export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const { recentSales, reprintSale, retryQuarantined, discardQuarantined, quarantinedCount } = usePos();
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [rejected, setRejected] = useState<Array<{ saleId: string; lastError?: string; queuedAt: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setSales(await recentSales());
    setRejected(await listQuarantined());
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function reprint(saleId: string) {
    setBusy(saleId);
    setError(null);
    setMessage(null);
    try {
      await reprintSale(saleId);
      setMessage('Cupom reenviado para a impressora.');
    } catch {
      setError('Não foi possível imprimir. Confira a impressora e tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-indigo">Últimas vendas</h2>
        <p className="mt-1 text-sm text-slate">
          Reimprima um cupom ou resolva uma venda que o servidor recusou.
        </p>

        {message && (
          <p className="mt-4 rounded-card bg-success-soft px-3 py-2 text-sm text-success">{message}</p>
        )}
        {error && <p className="mt-4 rounded-card bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {quarantinedCount > 0 && (
          <section className="mt-5">
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-danger">
              {rejected.length} venda(s) recusada(s)
            </h3>
            <p className="mt-1 text-xs text-slate">
              Não subiram e não vão subir sozinhas. Depois de resolver a causa — cadastrar a entrada
              de estoque que faltava, por exemplo — mande de novo.
            </p>
            <ul className="mt-3 space-y-2">
              {rejected.map((entry) => (
                <li key={entry.saleId} className="rounded-card border border-danger/30 bg-danger-soft p-3">
                  <p className="font-mono text-[11px] text-danger">{entry.lastError ?? 'Recusada'}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate">
                    {new Date(entry.queuedAt).toLocaleString('pt-BR')}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn-primary px-4 py-1 text-xs"
                      onClick={async () => {
                        await retryQuarantined(entry.saleId);
                        setMessage('Venda devolvida à fila.');
                        await refresh();
                      }}
                    >
                      Mandar de novo
                    </button>
                    <button
                      className="font-mono text-[10px] uppercase tracking-widest text-slate hover:text-danger"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            'Descartar esta venda? Ela não vai existir no faturamento nem gerar nota fiscal.',
                          )
                        )
                          return;
                        await discardQuarantined(entry.saleId);
                        await refresh();
                      }}
                    >
                      descartar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-slate">Cupons deste terminal</h3>
          {sales.length === 0 ? (
            <p className="mt-3 text-sm text-slate">Nenhuma venda ainda neste terminal.</p>
          ) : (
            <ul className="mt-3 divide-y divide-lavender-200">
              {sales.map((sale) => (
                <li key={sale.saleId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-indigo">{formatMoney(sale.totalCents)}</p>
                    <p className="font-mono text-[11px] text-slate">
                      {new Date(sale.occurredAt).toLocaleString('pt-BR')} · {sale.itemCount} item(ns)
                      {sale.operatorName && ` · ${sale.operatorName}`}
                    </p>
                  </div>
                  <button
                    className="btn-ghost px-4 py-1 text-xs"
                    disabled={busy === sale.saleId}
                    onClick={() => reprint(sale.saleId)}
                  >
                    {busy === sale.saleId ? 'Imprimindo...' : 'Reimprimir'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button className="mt-6 w-full text-xs text-slate hover:text-indigo" onClick={onClose}>
          Voltar à venda (ESC)
        </button>
      </div>
    </div>
  );
}
