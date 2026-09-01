import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney, formatQuantity } from '@soul/ui';
import { usePos } from '../store/pos-store';
import { cartTotal, findByBarcode, searchCatalog } from '../lib/cart';
import type { CachedCatalogItem } from '../lib/db';
import { openDrawer, printReceipt, readScale } from '../lib/scale';
import { PaymentDialog } from './PaymentDialog';
import { WeightDialog } from './WeightDialog';

/**
 * Tela de venda.
 *
 * Toda a operação é feita por teclado: o atendente do quiosque tem uma mão no
 * leitor e outra no teclado, e nenhuma no mouse.
 */
export function SaleScreen() {
  const { catalog, cart, addItem, removeLine, clearCart, finalizeSale } = usePos();
  const [term, setTerm] = useState('');
  const [weighing, setWeighing] = useState<CachedCatalogItem | null>(null);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => searchCatalog(catalog, term), [catalog, term]);
  const total = cartTotal(cart);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2' && cart.length > 0) {
        event.preventDefault();
        setPaying(true);
      }
      if (event.key === 'F4') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setTerm('');
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length]);

  async function pick(item: CachedCatalogItem) {
    setTerm('');
    searchRef.current?.focus();

    if (!item.soldByWeight) {
      addItem(item, 1);
      return;
    }

    // Item por peso: tenta a balança primeiro; só cai para digitação se ela não responder.
    const reading = await readScale();
    if (reading?.stable && reading.weightKg > 0) {
      addItem(item, reading.weightKg, { weighed: true });
      return;
    }
    setWeighing(item);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const scanned = findByBarcode(catalog, term.trim());
    const chosen = scanned ?? suggestions[0];
    if (chosen) void pick(chosen);
  }

  async function onPaid(payments: Parameters<typeof finalizeSale>[0], document?: string) {
    const sale = await finalizeSale(payments, document);
    setPaying(false);
    setMessage(`Venda registrada · ${formatMoney(sale.totalCents)}`);
    void printReceipt({ sale });
    if (payments.some((payment) => payment.method === 'cash')) void openDrawer();
    setTimeout(() => setMessage(null), 4000);
    searchRef.current?.focus();
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
      <section className="card flex min-h-0 flex-col overflow-hidden">
        <form onSubmit={submitSearch} className="border-b border-lavender-200 p-4">
          <input
            ref={searchRef}
            className="field text-lg"
            placeholder="Leia o código ou digite o produto (F4)"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoFocus
          />
          {suggestions.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-lavender-200">
              {suggestions.map((item, index) => (
                <li key={item.skuId}>
                  <button
                    type="button"
                    onClick={() => void pick(item)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-lavender"
                  >
                    <span className="text-sm text-indigo">
                      {index === 0 && <span className="mr-2 font-mono text-[10px] text-violet">ENTER</span>}
                      {item.description}
                      {item.soldByWeight && (
                        <span className="ml-2 rounded-pill bg-lavender-200 px-2 py-0.5 font-mono text-[10px] text-violet">
                          por peso
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-slate">
                      {formatMoney(item.priceCents)}
                      {item.soldByWeight ? '/kg' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-soft">
              Carrinho vazio. Leia o primeiro produto para começar.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-lavender text-left font-mono text-[10px] uppercase tracking-widest text-slate">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Qtd</th>
                  <th className="px-4 py-2 text-right">Unitário</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.lineNumber} className="border-b border-lavender-200 last:border-0">
                    <td className="px-4 py-3 text-indigo">
                      {line.description}
                      {line.weighed && (
                        <span className="ml-2 font-mono text-[10px] uppercase text-violet">balança</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate">
                      {formatQuantity(line.quantity, line.unit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate">
                      {formatMoney(line.unitPriceCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-indigo">
                      {formatMoney(line.totalCents)}
                    </td>
                    <td className="pr-3">
                      <button
                        onClick={() => removeLine(line.lineNumber)}
                        className="rounded-pill px-2 py-1 font-mono text-[10px] uppercase text-danger hover:bg-danger-soft"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="card p-6">
          <p className="label">Total da venda</p>
          <p className="font-display text-5xl font-bold tabular-nums text-indigo">{formatMoney(total)}</p>
          <p className="mt-1 font-mono text-xs text-slate">
            {cart.length} {cart.length === 1 ? 'item' : 'itens'}
          </p>

          <button
            className="btn-primary mt-6 w-full text-base"
            disabled={cart.length === 0}
            onClick={() => setPaying(true)}
          >
            Receber · F2
          </button>
          <button className="btn-ghost mt-2 w-full" disabled={cart.length === 0} onClick={clearCart}>
            Cancelar venda
          </button>
        </div>

        {message && (
          <div className="rounded-card border border-success/30 bg-success-soft p-4 text-sm text-success">
            {message}
          </div>
        )}

        <div className="card p-4 text-xs text-slate">
          <p className="label">Atalhos</p>
          <ul className="space-y-1 font-mono">
            <li>F2 — receber</li>
            <li>F4 — voltar à busca</li>
            <li>ESC — limpar busca</li>
          </ul>
        </div>
      </aside>

      {weighing && (
        <WeightDialog
          item={weighing}
          onCancel={() => setWeighing(null)}
          onConfirm={(quantity) => {
            addItem(weighing, quantity, { weighed: false });
            setWeighing(null);
            searchRef.current?.focus();
          }}
        />
      )}

      {paying && <PaymentDialog totalCents={total} onCancel={() => setPaying(false)} onConfirm={onPaid} />}
    </div>
  );
}
