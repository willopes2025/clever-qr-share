import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@soul/ui';
import { usePos } from '../store/pos-store';
import { cartTotal, findByBarcode, searchCatalog } from '../lib/cart';
import type { CachedCatalogItem } from '../lib/db';
import { PaymentDialog } from './PaymentDialog';

/**
 * Tela de venda.
 *
 * Tudo é vendido por pote fechado: ler o código soma uma unidade, e ler o mesmo
 * pote de novo soma na mesma linha. A operação inteira é feita por teclado — o
 * atendente tem uma mão no leitor e outra no teclado, e nenhuma no mouse.
 */
export function SaleScreen() {
  const { catalog, cart, addItem, setLineQuantity, removeLine, clearCart, finalizeSale, printSale } = usePos();
  const [term, setTerm] = useState('');
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

  function pick(item: CachedCatalogItem) {
    addItem(item);
    setTerm('');
    searchRef.current?.focus();
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const chosen = findByBarcode(catalog, term.trim()) ?? suggestions[0];
    if (chosen) pick(chosen);
  }

  async function onPaid(payments: Parameters<typeof finalizeSale>[0], document?: string) {
    const sale = await finalizeSale(payments, document);
    setPaying(false);
    setMessage(`Venda registrada · ${formatMoney(sale.totalCents)}`);
    void printSale(sale);
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
                    onClick={() => pick(item)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-lavender"
                  >
                    <span className="text-sm text-indigo">
                      {index === 0 && <span className="mr-2 font-mono text-[10px] text-violet">ENTER</span>}
                      {item.description}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-slate">
                      {formatMoney(item.priceCents)}
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
              Carrinho vazio. Leia o primeiro pote para começar.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-lavender text-left font-mono text-[10px] uppercase tracking-widest text-slate">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-center">Qtd</th>
                  <th className="px-4 py-2 text-right">Unitário</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.lineNumber} className="border-b border-lavender-200 last:border-0">
                    <td className="px-4 py-3 text-indigo">{line.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <StepButton
                          label="menos um"
                          onClick={() => setLineQuantity(line.lineNumber, line.quantity - 1)}
                        >
                          −
                        </StepButton>
                        <span className="w-8 text-center font-mono tabular-nums text-indigo">
                          {line.quantity}
                        </span>
                        <StepButton
                          label="mais um"
                          onClick={() => setLineQuantity(line.lineNumber, line.quantity + 1)}
                        >
                          +
                        </StepButton>
                      </div>
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
            {itemCount(cart)} {itemCount(cart) === 1 ? 'item' : 'itens'}
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

      {paying && <PaymentDialog totalCents={total} onCancel={() => setPaying(false)} onConfirm={onPaid} />}
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-7 w-7 rounded-full border border-lavender-400 font-mono text-indigo hover:border-violet hover:text-violet"
    >
      {children}
    </button>
  );
}

function itemCount(cart: ReadonlyArray<{ quantity: number }>): number {
  return cart.reduce((total, line) => total + line.quantity, 0);
}
