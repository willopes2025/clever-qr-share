import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type RecipeDetail, type StockBalance } from '../lib/api';
import { ErrorNote, Field, Modal } from '../components/ui';

interface Line {
  skuId: string;
  quantity: string;
}

/**
 * Ficha técnica de um item.
 *
 * É o cadastro que faz um pote de sorvete tirar do granel e da embalagem em vez
 * de tirar de si mesmo. A escolha entre montagem e produção decide só *quando*
 * a baixa acontece — na venda ou no apontamento —, e é a diferença entre o pote
 * que se monta na hora e o sorvete que a máquina faz antes.
 */
export function RecipeDialog({
  skuId,
  description,
  onClose,
}: {
  skuId: string;
  description: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const recipe = useQuery({
    queryKey: ['recipe', skuId],
    queryFn: () => api<RecipeDetail | null>(`/inventory/recipes/${skuId}`),
  });

  // Todo SKU serve de insumo; a lista de saldos é a forma mais curta de tê-los.
  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Array<{ id: string }>>('/stores') });
  const options = useQuery({
    queryKey: ['recipe-skus', stores.data?.[0]?.id],
    queryFn: () => api<StockBalance[]>(`/inventory/balances?storeId=${stores.data![0]!.id}`),
    enabled: Boolean(stores.data?.length),
  });

  const [kind, setKind] = useState<'assembly' | 'production'>('assembly');
  const [outputQuantity, setOutputQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ skuId: '', quantity: '' }]);
  const [loaded, setLoaded] = useState(false);

  // Carrega uma vez, quando a ficha chega; depois o formulário é do usuário.
  if (!loaded && recipe.isFetched) {
    if (recipe.data) {
      setKind(recipe.data.kind);
      setOutputQuantity(String(recipe.data.outputQuantity));
      setNotes(recipe.data.notes ?? '');
      setLines(
        recipe.data.items.length
          ? recipe.data.items.map((item) => ({ skuId: item.skuId, quantity: String(item.quantity) }))
          : [{ skuId: '', quantity: '' }],
      );
    }
    setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () =>
      api(`/inventory/recipes/${skuId}`, {
        method: 'PUT',
        body: {
          kind,
          outputQuantity: Number(outputQuantity.replace(',', '.')),
          notes: notes.trim() || null,
          items: lines
            .filter((line) => line.skuId && Number(line.quantity.replace(',', '.')) > 0)
            .map((line) => ({
              skuId: line.skuId,
              quantity: Number(line.quantity.replace(',', '.')),
            })),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recipe', skuId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.'),
  });

  const remove = useMutation({
    mutationFn: () => api(`/inventory/recipes/${skuId}`, { method: 'DELETE' }),
    onSuccess: onClose,
  });

  const unidadeSaida = options.data?.find((option) => option.skuId === skuId);
  const valid = lines.some((line) => line.skuId && Number(line.quantity.replace(',', '.')) > 0);

  return (
    <Modal
      title={`Ficha técnica · ${description}`}
      onClose={onClose}
      wide
      footer={
        <>
          {recipe.data && (
            <button
              className="mr-auto font-mono text-[10px] uppercase tracking-widest text-slate hover:text-danger"
              onClick={() => {
                if (!window.confirm('Remover a ficha? O item voltará a baixar a si mesmo na venda.'))
                  return;
                remove.mutate();
              }}
            >
              remover ficha
            </button>
          )}
          <button className="btn-ghost px-4 py-2" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Salvar ficha'}
          </button>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field label="Quando a baixa acontece">
        <select className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="assembly">Na venda — o item é montado na hora (pote, pizza, porção)</option>
          <option value="production">No apontamento — o item é produzido antes (sorvete, massa)</option>
        </select>
      </Field>

      <p className="mt-2 text-xs text-slate">
        {kind === 'assembly'
          ? 'Vender este item baixa os insumos abaixo, e não ele mesmo. Ele não precisa existir no estoque.'
          : 'Este item entra no estoque pelo apontamento de produção, consumindo os insumos abaixo.'}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Rendimento"
          hint={`Quanto sai de uma execução${unidadeSaida ? ` em ${unidadeSaida.unit}` : ''}. Ex.: 6 L de calda rendem 7,2 kg.`}
        >
          <input
            className="field"
            inputMode="decimal"
            value={outputQuantity}
            onChange={(e) => setOutputQuantity(e.target.value)}
          />
        </Field>
        <Field label="Observação" hint="Opcional.">
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <p className="mt-5 mb-2 font-mono text-[11px] uppercase tracking-widest text-slate">
        Insumos para esse rendimento
      </p>

      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="flex gap-2">
            <select
              className="field flex-1"
              value={line.skuId}
              onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, skuId: e.target.value } : l)))}
            >
              <option value="">Selecione o insumo</option>
              {options.data
                ?.filter((option) => option.skuId !== skuId)
                .map((option) => (
                  <option key={option.skuId} value={option.skuId}>
                    {option.description} ({option.code})
                  </option>
                ))}
            </select>
            <input
              className="field w-32"
              inputMode="decimal"
              placeholder="qtd"
              value={line.quantity}
              onChange={(e) =>
                setLines(lines.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))
              }
            />
            {lines.length > 1 && (
              <button
                className="px-2 font-mono text-[10px] uppercase text-slate hover:text-danger"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        className="btn-ghost mt-3 px-4 py-2 text-xs"
        onClick={() => setLines([...lines, { skuId: '', quantity: '' }])}
      >
        Adicionar insumo
      </button>
    </Modal>
  );
}
