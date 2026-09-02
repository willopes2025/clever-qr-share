import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@soul/ui';
import { api, ApiError, type Product, type ProductSku } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';

/** Cadastro de produto e suas variações — sabor e tamanho viram um SKU cada. */
export function ProductsScreen() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const products = useQuery({
    queryKey: ['products', search],
    queryFn: () => api<Product[]>(`/products?search=${encodeURIComponent(search)}`),
  });

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Cada sabor e tamanho é uma variação com preço e código próprios."
        action={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            Novo produto
          </button>
        }
      />

      <input
        className="field mb-4"
        placeholder="Buscar por nome, descrição ou código"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {products.data?.length === 0 ? (
        <EmptyState message="Nenhum produto encontrado." />
      ) : (
        <div className="space-y-3">
          {products.data?.map((product) => (
            <article key={product.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-indigo">{product.name}</h2>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-slate">
                    {product.categoryName ?? 'sem categoria'} · NCM {product.ncm ?? '—'} · CEST{' '}
                    {product.cest ?? '—'} ·{' '}
                    {product.skus.length} {product.skus.length === 1 ? 'variação' : 'variações'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!product.active && <Pill tone="off">inativo</Pill>}
                  <button className="btn-ghost px-4 py-2 text-xs" onClick={() => setEditing(product)}>
                    Editar
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-slate">
                    <tr>
                      <th className="pb-1">Variação</th>
                      <th className="pb-1">Código</th>
                      <th className="pb-1">Código de barras</th>
                      <th className="pb-1 text-right">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.skus.map((sku) => (
                      <tr key={sku.id} className="border-t border-lavender-200">
                        <td className="py-2 text-indigo">
                          {sku.description}
                          {sku.active === false && <span className="ml-2 text-xs text-slate">(inativo)</span>}
                        </td>
                        <td className="py-2 font-mono text-xs text-slate">{sku.code}</td>
                        <td className="py-2 font-mono text-xs text-slate">{sku.barcode ?? '—'}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-indigo">
                          {sku.priceCents === null ? 'sem preço' : formatMoney(sku.priceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <ProductForm product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

interface DraftSku extends Omit<ProductSku, 'priceCents'> {
  price: string;
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(product?.name ?? '');
  const [ncm, setNcm] = useState(product?.ncm ?? '');
  const [cest, setCest] = useState(product?.cest ?? '');
  const [skus, setSkus] = useState<DraftSku[]>(
    product?.skus.map((sku) => ({ ...sku, price: toInput(sku.priceCents) })) ?? [
      { code: '', description: '', barcode: '', price: '' },
    ],
  );

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Array<{ id: string; name: string }>>('/products/categories'),
  });
  const [categoryId, setCategoryId] = useState<string>('');

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        ncm: ncm || null,
        cest: cest || null,
        categoryId: categoryId || null,
        skus: skus.map((sku) => ({
          id: sku.id,
          code: sku.code.trim(),
          description: sku.description.trim(),
          barcode: sku.barcode?.trim() || null,
          priceCents: toCentsOrZero(sku.price),
        })),
      };
      return product
        ? api(`/products/${product.id}`, { method: 'PUT', body })
        : api('/products', { method: 'POST', body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const valid = useMemo(
    () =>
      name.trim().length > 1 &&
      skus.length > 0 &&
      skus.every((sku) => sku.code.trim() && sku.description.trim() && toCentsOrZero(sku.price) > 0),
    [name, skus],
  );

  function updateSku(index: number, patch: Partial<DraftSku>) {
    setSkus(skus.map((sku, position) => (position === index ? { ...sku, ...patch } : sku)));
  }

  return (
    <Modal
      wide
      title={product ? 'Editar produto' : 'Novo produto'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Nome do produto">
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>
        </div>
        <Field label="NCM" hint="8 dígitos, usado na nota">
          <input
            className="field font-mono"
            value={ncm}
            onChange={(event) => setNcm(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="21050010"
          />
        </Field>
        <Field label="CEST" hint="7 dígitos. Preencha se o produto tem ICMS por substituição tributária — sorvete tem.">
          <input
            className="field font-mono"
            value={cest}
            onChange={(event) => setCest(event.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="2300100"
          />
        </Field>
      </div>

      {ncm.startsWith('2105') && !cest && (
        <p className="mt-2 text-xs text-amber-700">
          NCM de sorvete sem CEST. A SEFAZ costuma rejeitar a NFC-e desse item — sorvete de
          qualquer espécie é CEST 23.001.00.
        </p>
      )}

      <div className="mt-4">
        <Field label="Categoria">
          <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">sem categoria</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <h3 className="mb-2 mt-6 font-display text-sm font-semibold text-indigo">Variações</h3>
      <div className="space-y-2">
        {skus.map((sku, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-lavender-200 p-3 sm:grid-cols-12">
            <input
              className="field sm:col-span-4"
              placeholder="Descrição (Pote 500ml Napolitano)"
              value={sku.description}
              onChange={(event) => updateSku(index, { description: event.target.value })}
            />
            <input
              className="field font-mono sm:col-span-2"
              placeholder="Código"
              value={sku.code}
              onChange={(event) => updateSku(index, { code: event.target.value })}
            />
            <input
              className="field font-mono sm:col-span-3"
              placeholder="Código de barras"
              value={sku.barcode ?? ''}
              onChange={(event) => updateSku(index, { barcode: event.target.value.replace(/\D/g, '') })}
            />
            <input
              className="field text-right tabular-nums sm:col-span-2"
              placeholder="0,00"
              value={sku.price}
              onChange={(event) => updateSku(index, { price: event.target.value })}
            />
            <button
              className="font-mono text-[10px] uppercase text-danger sm:col-span-1"
              onClick={() => setSkus(skus.filter((_, position) => position !== index))}
              disabled={skus.length === 1}
            >
              tirar
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn-ghost mt-3 px-4 py-2 text-xs"
        onClick={() => setSkus([...skus, { code: '', description: '', barcode: '', price: '' }])}
      >
        Adicionar variação
      </button>

      {save.isError && (
        <div className="mt-4">
          <ErrorNote>{describe(save.error)}</ErrorNote>
        </div>
      )}
    </Modal>
  );
}

function toInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

function toCentsOrZero(value: string): number {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'SKU_CODE_IN_USE') return 'Já existe outro produto com esse código interno.';
    if (error.code === 'BARCODE_IN_USE') return 'Esse código de barras já pertence a outro produto.';
    return error.message;
  }
  return 'Não foi possível salvar.';
}
