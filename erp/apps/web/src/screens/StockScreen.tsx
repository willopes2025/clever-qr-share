import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import {
  api,
  ApiError,
  type CountDifference,
  type StockBalance,
  type StockMovement,
  type Store,
} from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';

/**
 * Estoque da loja.
 *
 * Até aqui o sistema só sabia baixar estoque na venda — não havia porta para
 * fazer o saldo subir nem para acertá-lo com a prateleira. O que a tela mostra
 * primeiro é o que está errado: saldo negativo, depois abaixo do mínimo. O
 * resto é consulta.
 */
export function StockScreen() {
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'receipt' | 'count' | null>(null);
  const [extract, setExtract] = useState<StockBalance | null>(null);

  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Store[]>('/stores') });

  // A primeira loja da lista serve de padrão — quem tem um quiosque só nunca
  // precisa escolher nada.
  useEffect(() => {
    const first = stores.data?.[0];
    if (!storeId && first) setStoreId(first.id);
  }, [stores.data, storeId]);

  const balances = useQuery({
    queryKey: ['stock', storeId, search],
    queryFn: () =>
      api<StockBalance[]>(`/inventory/balances?storeId=${storeId}&search=${encodeURIComponent(search)}`),
    enabled: Boolean(storeId),
  });

  const problems = useMemo(
    () => (balances.data ?? []).filter((line) => line.negative || line.belowMinimum).length,
    [balances.data],
  );

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="O que tem em cada quiosque, o que está faltando e o que já ficou negativo."
        action={
          <div className="flex gap-2">
            <button className="btn-ghost px-4 py-2 text-xs" onClick={() => setDialog('count')}>
              Fazer contagem
            </button>
            <button className="btn-primary" onClick={() => setDialog('receipt')}>
              Registrar entrada
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field max-w-xs" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.data?.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <input
          className="field flex-1"
          placeholder="Buscar por descrição ou código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {problems > 0 && (
        <p className="mb-4 rounded-card bg-pink/10 px-4 py-3 text-sm text-magenta">
          {problems} produto(s) precisam de atenção — saldo negativo significa venda sem entrada
          cadastrada. A contagem acerta.
        </p>
      )}

      {balances.data?.length === 0 ? (
        <EmptyState message="Nenhum produto encontrado nesta loja." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lavender-200 text-left font-mono text-[11px] uppercase tracking-widest text-slate">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3 text-right">Custo médio</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {balances.data?.map((line) => (
                <tr key={line.skuId} className="border-b border-lavender-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-indigo">{line.description}</p>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-slate">{line.code}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={line.negative ? 'font-semibold text-danger' : 'text-indigo'}>
                      {line.quantity}
                    </span>
                    {line.negative && (
                      <span className="ml-2">
                        <Pill tone="warn">negativo</Pill>
                      </span>
                    )}
                    {!line.negative && line.belowMinimum && (
                      <span className="ml-2">
                        <Pill tone="warn">repor</Pill>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate">{line.minStock || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate">{formatMoney(line.avgCostCents)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate">
                    {line.nextExpiry ? line.nextExpiry.split('-').reverse().join('/') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="font-mono text-[10px] uppercase tracking-widest text-slate hover:text-violet"
                      onClick={() => setExtract(line)}
                    >
                      extrato
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog === 'receipt' && (
        <ReceiptForm storeId={storeId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'count' && (
        <CountForm storeId={storeId} balances={balances.data ?? []} onClose={() => setDialog(null)} />
      )}
      {extract && <Extract storeId={storeId} line={extract} onClose={() => setExtract(null)} />}
    </>
  );
}

interface ReceiptLine {
  skuId: string;
  quantity: string;
  unitCost: string;
  lotCode: string;
  expiresAt: string;
}

const emptyLine: ReceiptLine = { skuId: '', quantity: '', unitCost: '', lotCode: '', expiresAt: '' };

/** Recebimento: o que chegou do fornecedor, com lote e validade quando houver. */
function ReceiptForm({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [document, setDocument] = useState('');
  const [lines, setLines] = useState<ReceiptLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);

  const options = useQuery({
    queryKey: ['stock-skus', storeId],
    queryFn: () => api<StockBalance[]>(`/inventory/balances?storeId=${storeId}`),
    enabled: Boolean(storeId),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/inventory/receipts', {
        method: 'POST',
        body: {
          storeId,
          document: document.trim() || null,
          items: lines
            .filter((line) => line.skuId && Number(line.quantity) > 0)
            .map((line) => ({
              skuId: line.skuId,
              quantity: Number(line.quantity.replace(',', '.')),
              unitCostCents: Math.round(Number(line.unitCost.replace(',', '.') || 0) * 100),
              lotCode: line.lotCode.trim() || null,
              expiresAt: line.expiresAt || null,
            })),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.'),
  });

  const valid = lines.some((line) => line.skuId && Number(line.quantity) > 0);

  return (
    <Modal
      title="Registrar entrada de mercadoria"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-ghost px-4 py-2" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Dar entrada'}
          </button>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field label="Nota do fornecedor" hint="Opcional — fica no extrato de cada item.">
        <input className="field" value={document} onChange={(e) => setDocument(e.target.value)} />
      </Field>

      <div className="mt-4 space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="rounded-card border border-lavender-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Produto">
                <select
                  className="field"
                  value={line.skuId}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, skuId: e.target.value } : l)))
                  }
                >
                  <option value="">Selecione</option>
                  {options.data?.map((option) => (
                    <option key={option.skuId} value={option.skuId}>
                      {option.description} ({option.code})
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade">
                  <input
                    className="field"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines(lines.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))
                    }
                  />
                </Field>
                <Field label="Custo unitário" hint="R$">
                  <input
                    className="field"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={line.unitCost}
                    onChange={(e) =>
                      setLines(lines.map((l, i) => (i === index ? { ...l, unitCost: e.target.value } : l)))
                    }
                  />
                </Field>
              </div>
              <Field label="Lote" hint="Deixe vazio se o produto não tem lote.">
                <input
                  className="field"
                  value={line.lotCode}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, lotCode: e.target.value } : l)))
                  }
                />
              </Field>
              <Field label="Validade">
                <input
                  className="field"
                  type="date"
                  value={line.expiresAt}
                  onChange={(e) =>
                    setLines(lines.map((l, i) => (i === index ? { ...l, expiresAt: e.target.value } : l)))
                  }
                />
              </Field>
            </div>
            {lines.length > 1 && (
              <button
                className="mt-2 font-mono text-[10px] uppercase tracking-widest text-slate hover:text-danger"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                remover item
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="btn-ghost mt-3 px-4 py-2 text-xs" onClick={() => setLines([...lines, { ...emptyLine }])}>
        Adicionar item
      </button>
    </Modal>
  );
}

/**
 * Contagem.
 *
 * Pede o que foi contado na prateleira, não a diferença — quem conta não
 * deveria fazer subtração de cabeça. O resultado mostra o que estava errado.
 */
function CountForm({
  storeId,
  balances,
  onClose,
}: {
  storeId: string;
  balances: StockBalance[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Contagem de inventário');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CountDifference[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api<{ checked: number; differences: CountDifference[] }>('/inventory/counts', {
        method: 'POST',
        body: {
          storeId,
          reason: reason.trim(),
          items: Object.entries(counted)
            .filter(([, value]) => value.trim() !== '')
            .map(([skuId, value]) => ({
              skuId,
              countedQuantity: Number(value.replace(',', '.')),
            })),
        },
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      setResult(data.differences);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.'),
  });

  if (result) {
    return (
      <Modal
        title="Contagem registrada"
        onClose={onClose}
        footer={
          <button className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        }
      >
        {result.length === 0 ? (
          <p className="text-sm text-slate">
            Tudo bateu com o sistema. Nenhum ajuste foi necessário.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate">
              {result.length} produto(s) estavam diferentes. O saldo já foi corrigido.
            </p>
            <ul className="space-y-2">
              {result.map((line) => (
                <li key={line.skuId} className="flex justify-between rounded-card bg-lavender px-3 py-2 text-sm">
                  <span className="text-indigo">{line.description}</span>
                  <span className="font-mono text-xs text-slate">
                    sistema {line.expected} · contado {line.counted} ·{' '}
                    <strong className={line.difference < 0 ? 'text-danger' : 'text-ok'}>
                      {line.difference > 0 ? `+${line.difference}` : line.difference}
                    </strong>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    );
  }

  const filled = Object.values(counted).filter((value) => value.trim() !== '').length;

  return (
    <Modal
      title="Contagem de inventário"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-ghost px-4 py-2" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={filled === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando...' : `Registrar ${filled} item(ns)`}
          </button>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field label="Motivo" hint="Fica no extrato de cada acerto.">
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>

      <p className="mt-4 mb-2 text-sm text-slate">
        Preencha só o que contou. Em branco, o produto não é tocado.
      </p>

      <div className="space-y-2">
        {balances.map((line) => (
          <div key={line.skuId} className="flex items-center gap-3 rounded-card border border-lavender-200 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-indigo">{line.description}</p>
              <p className="font-mono text-[11px] text-slate">
                sistema: {line.quantity}
                {line.negative && ' · negativo'}
              </p>
            </div>
            <input
              className="field w-28 text-right"
              inputMode="decimal"
              placeholder="contado"
              value={counted[line.skuId] ?? ''}
              onChange={(e) => setCounted({ ...counted, [line.skuId]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

const KIND_LABEL: Record<string, string> = {
  sale: 'venda',
  purchase: 'entrada',
  adjust: 'ajuste',
  return: 'devolução',
  transfer_in: 'transferência recebida',
  transfer_out: 'transferência enviada',
  loss: 'perda',
};

/** Extrato: de onde veio e para onde foi cada unidade. */
function Extract({
  storeId,
  line,
  onClose,
}: {
  storeId: string;
  line: StockBalance;
  onClose: () => void;
}) {
  const movements = useQuery({
    queryKey: ['stock-movements', storeId, line.skuId],
    queryFn: () =>
      api<StockMovement[]>(`/inventory/movements?storeId=${storeId}&skuId=${line.skuId}`),
  });

  return (
    <Modal title={line.description} onClose={onClose} wide>
      {movements.data?.length === 0 ? (
        <EmptyState message="Nenhum movimento neste quiosque ainda." />
      ) : (
        <ul className="space-y-2">
          {movements.data?.map((movement) => (
            <li key={movement.id} className="flex items-baseline justify-between gap-3 border-b border-lavender-100 pb-2">
              <div className="min-w-0">
                <p className="text-sm text-indigo">
                  {KIND_LABEL[movement.kind] ?? movement.kind}
                  {movement.lotCode && (
                    <span className="ml-2 font-mono text-[11px] text-slate">lote {movement.lotCode}</span>
                  )}
                </p>
                <p className="truncate font-mono text-[11px] text-slate">
                  {new Date(movement.occurredAt).toLocaleString('pt-BR')}
                  {movement.reason && ` · ${movement.reason}`}
                </p>
              </div>
              <span
                className={`font-mono text-sm ${movement.quantity < 0 ? 'text-danger' : 'text-ok'}`}
              >
                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
