import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import { api, ApiError, type SaleDetail, type SaleRow, type Store } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';
import { useOperationFeed } from '../lib/use-operation-feed';

const METHOD_LABEL: Record<string, string> = {
  cash: 'dinheiro',
  credit: 'crédito',
  debit: 'débito',
  pix: 'Pix',
  voucher: 'vale',
  store_credit: 'crédito da loja',
};

const FISCAL_LABEL: Record<string, string> = {
  queued: 'na fila',
  sending: 'enviando',
  authorized: 'autorizada',
  rejected: 'rejeitada',
  cancelled: 'cancelada',
};

/** Data de hoje no formato que o input date entende. */
function hoje(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Vendas do dia.
 *
 * Havia o agregado — faturamento, curva, mix — e nenhuma forma de olhar uma
 * venda. Cliente pedindo segunda via, contador perguntando de um cupom,
 * operador que registrou o item errado: tudo isso é uma venda específica.
 */
export function SalesScreen() {
  const feed = useOperationFeed();
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(hoje());
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<string | null>(null);

  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Store[]>('/stores') });

  const sales = useQuery({
    queryKey: ['sales', storeId, date, search],
    queryFn: () =>
      api<SaleRow[]>(
        `/sales?storeId=${storeId}&date=${date}&search=${encodeURIComponent(search)}`,
      ),
  });

  // Venda entrando ou sendo cancelada recarrega a lista sozinha.
  useEffect(() => {
    if (feed.lastSale) void sales.refetch();
  }, [feed.lastSale?.saleId]);

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Cada cupom do dia: o que foi vendido, como foi pago e o que a nota diz."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field max-w-xs" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">Todos os quiosques</option>
          {stores.data?.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <input className="field max-w-[10rem]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="field flex-1"
          placeholder="Número do cupom ou CPF do cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {sales.data?.length === 0 ? (
        <EmptyState message="Nenhuma venda neste dia." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lavender-200 text-left font-mono text-[11px] uppercase tracking-widest text-slate">
                <th className="px-4 py-3">Cupom</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Quiosque</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.data?.map((sale) => (
                <tr
                  key={sale.id}
                  className="cursor-pointer border-b border-lavender-100 last:border-0 hover:bg-lavender"
                  onClick={() => setOpened(sale.id)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-indigo">#{sale.number}</span>
                    {sale.status === 'cancelled' && (
                      <span className="ml-2">
                        <Pill tone="warn">cancelada</Pill>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate">
                    {new Date(sale.occurredAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {sale.storeName}
                    {sale.terminalCode && (
                      <span className="ml-1 font-mono text-[11px]">· {sale.terminalCode}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {sale.methods.map((method) => METHOD_LABEL[method] ?? method).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    {sale.fiscal ? (
                      <Pill tone={sale.fiscal.status === 'authorized' ? 'ok' : 'warn'}>
                        {FISCAL_LABEL[sale.fiscal.status] ?? sale.fiscal.status}
                      </Pill>
                    ) : (
                      <span className="text-slate-soft">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      sale.status === 'cancelled' ? 'text-slate line-through' : 'text-indigo'
                    }`}
                  >
                    {formatMoney(sale.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {opened && <SaleDetailModal saleId={opened} onClose={() => setOpened(null)} />}
    </>
  );
}

/** O cupom inteiro: é o que vira segunda via e o que o contador confere. */
function SaleDetailModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sale = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api<SaleDetail>(`/sales/${saleId}`),
  });

  const cancel = useMutation({
    mutationFn: () =>
      api<{ status: string; fiscalCancelled: boolean }>(`/sales/${saleId}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      await queryClient.invalidateQueries({ queryKey: ['live'] });
      setCancelling(false);
      setReason('');
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar a venda.'),
  });

  const data = sale.data;

  return (
    <Modal
      title={data ? `Cupom #${data.number}` : 'Carregando...'}
      onClose={onClose}
      wide
      footer={
        data?.status === 'completed' ? (
          <button className="btn-ghost px-4 py-2 text-danger" onClick={() => setCancelling(true)}>
            Cancelar venda
          </button>
        ) : undefined
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      {data && (
        <>
          <div className="mb-4 grid gap-1 font-mono text-[11px] uppercase tracking-widest text-slate">
            <span>
              {data.storeName}
              {data.terminalCode && ` · ${data.terminalCode}`}
              {data.operatorName && ` · ${data.operatorName}`}
            </span>
            <span>{new Date(data.occurredAt).toLocaleString('pt-BR')}</span>
            {data.customerDocument && <span>CPF {data.customerDocument}</span>}
          </div>

          {data.status === 'cancelled' && (
            <p className="mb-4 rounded-card bg-pink/10 px-3 py-2 text-sm text-magenta">
              Esta venda foi cancelada. Não conta no faturamento e o estoque já foi devolvido.
            </p>
          )}

          <table className="mb-4 w-full text-sm">
            <tbody>
              {data.items.map((item) => (
                <tr key={item.lineNumber} className="border-b border-lavender-100">
                  <td className="py-2">
                    <p className="text-indigo">{item.description}</p>
                    <p className="font-mono text-[11px] text-slate">
                      {item.quantity} {item.unit} × {formatMoney(item.unitPriceCents)}
                    </p>
                  </td>
                  <td className="py-2 text-right text-indigo">{formatMoney(item.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-4 space-y-1 text-sm">
            {data.discountCents > 0 && (
              <p className="flex justify-between text-slate">
                <span>Desconto</span>
                <span>−{formatMoney(data.discountCents)}</span>
              </p>
            )}
            <p className="flex justify-between font-display text-base font-bold text-indigo">
              <span>Total</span>
              <span>{formatMoney(data.totalCents)}</span>
            </p>
            {data.payments.map((payment, index) => (
              <p key={index} className="flex justify-between text-slate">
                <span>
                  {METHOD_LABEL[payment.method] ?? payment.method}
                  {payment.cardBrand && ` · ${payment.cardBrand}`}
                  {payment.installments > 1 && ` · ${payment.installments}x`}
                </span>
                <span>{formatMoney(payment.amountCents)}</span>
              </p>
            ))}
            {data.payments.some((payment) => payment.changeCents > 0) && (
              <p className="flex justify-between text-slate">
                <span>Troco</span>
                <span>
                  {formatMoney(data.payments.reduce((total, p) => total + p.changeCents, 0))}
                </span>
              </p>
            )}
          </div>

          {data.fiscal && (
            <div className="rounded-card bg-lavender px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 text-indigo">
                NFC-e
                <Pill tone={data.fiscal.status === 'authorized' ? 'ok' : 'warn'}>
                  {FISCAL_LABEL[data.fiscal.status] ?? data.fiscal.status}
                </Pill>
                {data.fiscal.number && <span className="text-slate">nº {data.fiscal.number}</span>}
              </p>
              {data.fiscal.accessKey && (
                <p className="break-all font-mono text-[11px] text-slate">{data.fiscal.accessKey}</p>
              )}
              {data.fiscal.rejectionMsg && (
                <p className="mt-1 text-xs text-magenta">{data.fiscal.rejectionMsg}</p>
              )}
              {data.fiscal.danfeUrl && (
                <a
                  className="mt-2 inline-block font-mono text-[11px] uppercase tracking-widest text-violet hover:underline"
                  href={data.fiscal.danfeUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  abrir cupom
                </a>
              )}
            </div>
          )}
        </>
      )}

      {cancelling && (
        <div className="mt-5 rounded-card border border-danger/30 bg-danger-soft p-4">
          <Field
            label="Motivo do cancelamento"
            hint="Fica no histórico. Quem auditar meses depois lê isto."
          >
            <input
              className="field"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cliente desistiu após o pagamento"
            />
          </Field>
          <p className="mt-2 text-xs text-slate">
            A nota fiscal será cancelada na SEFAZ e o estoque volta. A SEFAZ aceita cancelamento de
            NFC-e por até 30 minutos após a autorização.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost px-4 py-2" onClick={() => setCancelling(false)}>
              Voltar
            </button>
            <button
              className="btn-primary"
              disabled={reason.trim().length < 5 || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
