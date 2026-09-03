import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import { api, ApiError, type ProductionRow, type StockBalance } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, Pill } from '../components/ui';

interface ProductionResult {
  producedQuantity: number;
  expectedQuantity: number;
  yieldRatio: number | null;
  inputCostCents: number;
  unitCostCents: number;
}

/** 0,95 vira "95%"; nulo vira traço. */
function percent(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

/**
 * Apontamento de produção.
 *
 * Pede o que saiu da máquina, não o que a receita prometia — é justamente a
 * diferença entre os dois que mostra a máquina desregulando ao longo da semana.
 * O histórico fica lado a lado por isso: um dia a 95% é normal, três dias caindo
 * é manutenção.
 */
export function ProductionDialog({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [outputSkuId, setOutputSkuId] = useState('');
  const [produced, setProduced] = useState('');
  const [batches, setBatches] = useState('1');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<ProductionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = useQuery({
    queryKey: ['stock', storeId, ''],
    queryFn: () => api<StockBalance[]>(`/inventory/balances?storeId=${storeId}&search=`),
    enabled: Boolean(storeId),
  });

  const history = useQuery({
    queryKey: ['productions', storeId],
    queryFn: () => api<ProductionRow[]>(`/inventory/productions?storeId=${storeId}`),
    enabled: Boolean(storeId),
  });

  const save = useMutation({
    mutationFn: () =>
      api<ProductionResult>('/inventory/productions', {
        method: 'POST',
        body: {
          storeId,
          outputSkuId,
          producedQuantity: Number(produced.replace(',', '.')),
          batches: Number(batches.replace(',', '.')) || 1,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['productions'] });
      setResult(data);
      setProduced('');
      setNotes('');
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível registrar. Confira se o item tem ficha técnica.',
      ),
  });

  const saida = options.data?.find((option) => option.skuId === outputSkuId);
  const valid = outputSkuId && Number(produced.replace(',', '.')) > 0;

  return (
    <Modal
      title="Produção"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-ghost px-4 py-2" onClick={onClose}>
            Fechar
          </button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Registrando...' : 'Registrar produção'}
          </button>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      {result && (
        <div className="mb-5 rounded-card bg-lavender p-4">
          <p className="font-display text-sm font-semibold text-indigo">
            Produção registrada · rendimento {percent(result.yieldRatio)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate">
            previsto {result.expectedQuantity} · saiu {result.producedQuantity} ·{' '}
            {formatMoney(result.unitCostCents)} por unidade
          </p>
          {result.yieldRatio !== null && result.yieldRatio < 0.9 && (
            <p className="mt-2 text-xs text-magenta">
              Rendeu bem abaixo do previsto. Vale conferir a regulagem da máquina antes da próxima.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="O que foi produzido">
          <select className="field" value={outputSkuId} onChange={(e) => setOutputSkuId(e.target.value)}>
            <option value="">Selecione</option>
            {options.data?.map((option) => (
              <option key={option.skuId} value={option.skuId}>
                {option.description} ({option.unit})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`Quanto saiu${saida ? ` (${saida.unit})` : ''}`}
          hint="O que foi medido na saída, não o que a receita prometia."
        >
          <input
            className="field"
            inputMode="decimal"
            value={produced}
            onChange={(e) => setProduced(e.target.value)}
          />
        </Field>
        <Field label="Bateladas" hint="Quantas vezes a receita foi executada.">
          <input
            className="field"
            inputMode="decimal"
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
          />
        </Field>
        <Field label="Observação" hint="Opcional. Ex.: máquina 1.">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <h3 className="mb-2 mt-6 font-mono text-[11px] uppercase tracking-widest text-slate">
        Produções recentes
      </h3>

      {history.data?.length === 0 ? (
        <EmptyState message="Nenhuma produção apontada nesta loja." />
      ) : (
        <ul className="divide-y divide-lavender-200">
          {history.data?.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-indigo">
                  {row.outputDescription}
                  {row.notes && <span className="ml-2 text-xs text-slate">{row.notes}</span>}
                </p>
                <p className="font-mono text-[11px] text-slate">
                  {new Date(row.occurredAt).toLocaleString('pt-BR')} · saiu {row.producedQuantity}{' '}
                  {row.outputUnit} de {row.expectedQuantity} previstos ·{' '}
                  {formatMoney(row.unitCostCents)}/{row.outputUnit}
                </p>
                {row.inputs.length > 0 && (
                  <p className="font-mono text-[10px] text-slate-soft">
                    consumiu{' '}
                    {row.inputs
                      .map((input) => `${input.quantity} ${input.unit} de ${input.description}`)
                      .join(', ')}
                  </p>
                )}
              </div>
              <Pill tone={row.yieldRatio !== null && row.yieldRatio < 0.9 ? 'warn' : 'ok'}>
                {percent(row.yieldRatio)}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
