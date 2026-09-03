import { describe, expect, it } from 'vitest';
import {
  explodeRecipe,
  producedUnitCostCents,
  RecipeCycleError,
  yieldRatio,
  type Recipe,
} from './bom';

/** O caso real do quiosque: calda vira granel, granel e embalagem viram pote. */
const granel: Recipe = {
  outputSkuId: 'granel-chocolate',
  outputQuantity: 7.2, // kg de sorvete
  components: [{ skuId: 'calda-chocolate', quantity: 6 }], // litros de calda
};

const poteP: Recipe = {
  outputSkuId: 'pote-p',
  outputQuantity: 1,
  components: [
    { skuId: 'granel-chocolate', quantity: 0.12 }, // 120 g
    { skuId: 'embalagem-p', quantity: 1 },
  ],
};

const poteG: Recipe = {
  outputSkuId: 'pote-g',
  outputQuantity: 1,
  components: [
    { skuId: 'granel-chocolate', quantity: 0.3 },
    { skuId: 'embalagem-g', quantity: 1 },
  ],
};

const fichas = new Map<string, Recipe>([
  ['pote-p', poteP],
  ['pote-g', poteG],
]);

describe('explosão da ficha técnica', () => {
  it('item sem ficha sai ele mesmo do estoque', () => {
    expect(explodeRecipe('agua-500', 3, fichas)).toEqual([{ skuId: 'agua-500', quantity: 3 }]);
  });

  it('pote não sai do estoque: saem o sorvete e a embalagem', () => {
    expect(explodeRecipe('pote-p', 1, fichas)).toEqual([
      { skuId: 'granel-chocolate', quantity: 0.12 },
      { skuId: 'embalagem-p', quantity: 1 },
    ]);
  });

  it('escala com a quantidade vendida', () => {
    expect(explodeRecipe('pote-g', 4, fichas)).toEqual([
      { skuId: 'granel-chocolate', quantity: 1.2 },
      { skuId: 'embalagem-g', quantity: 4 },
    ]);
  });

  it('potes de tamanhos diferentes somam no mesmo granel', () => {
    // Uma venda com 2 potes P e 1 pote G tira 0,54 kg do mesmo tanque.
    const total = new Map<string, number>();
    for (const [sku, qtd] of [['pote-p', 2], ['pote-g', 1]] as const) {
      for (const item of explodeRecipe(sku, qtd, fichas)) {
        total.set(item.skuId, (total.get(item.skuId) ?? 0) + item.quantity);
      }
    }
    expect(total.get('granel-chocolate')).toBeCloseTo(0.54, 4);
    expect(total.get('embalagem-p')).toBe(2);
    expect(total.get('embalagem-g')).toBe(1);
  });

  it('desce mais de um nível quando o insumo também tem ficha', () => {
    // Se o granel for montado na hora em vez de produzido, o pote tem que
    // chegar até a calda sozinho.
    const encadeadas = new Map(fichas);
    encadeadas.set('granel-chocolate', granel);

    const resultado = explodeRecipe('pote-p', 1, encadeadas);
    // 0,12 kg de granel ÷ 7,2 kg de rendimento × 6 L de calda = 0,1 L
    expect(resultado).toContainEqual({ skuId: 'calda-chocolate', quantity: 0.1 });
    expect(resultado).toContainEqual({ skuId: 'embalagem-p', quantity: 1 });
    expect(resultado.some((item) => item.skuId === 'granel-chocolate')).toBe(false);
  });

  it('ficha circular é erro de cadastro, não estouro de pilha no meio da venda', () => {
    const circular = new Map<string, Recipe>([
      ['a', { outputSkuId: 'a', outputQuantity: 1, components: [{ skuId: 'b', quantity: 1 }] }],
      ['b', { outputSkuId: 'b', outputQuantity: 1, components: [{ skuId: 'a', quantity: 1 }] }],
    ]);
    expect(() => explodeRecipe('a', 1, circular)).toThrow(RecipeCycleError);
  });

  it('ficha sem insumo trata o item como folha, em vez de sumir com a baixa', () => {
    const vazia = new Map<string, Recipe>([
      ['pote-x', { outputSkuId: 'pote-x', outputQuantity: 1, components: [] }],
    ]);
    expect(explodeRecipe('pote-x', 2, vazia)).toEqual([{ skuId: 'pote-x', quantity: 2 }]);
  });
});

describe('rendimento da produção', () => {
  it('6 litros de calda rendendo 7,2 kg é o esperado da ficha', () => {
    expect(yieldRatio(7.2, 7.2)).toBe(1);
  });

  it('rendeu menos: a diferença aparece', () => {
    expect(yieldRatio(6.84, 7.2)).toBe(0.95);
  });

  it('rendeu mais que o previsto também aparece', () => {
    expect(yieldRatio(7.56, 7.2)).toBe(1.05);
  });

  it('sem expectativa não há rendimento a comparar', () => {
    expect(yieldRatio(7.2, 0)).toBeNull();
  });
});

describe('custo do produzido', () => {
  it('o custo dos insumos vai inteiro para o que saiu', () => {
    // 6 L de calda a R$ 30,00 = R$ 180,00 para 7,2 kg → R$ 25,00 o quilo.
    expect(producedUnitCostCents(18_000, 7.2)).toBe(2500);
  });

  it('produção que rendeu menos encarece o quilo, como na vida real', () => {
    // Mesma calda, 6,84 kg: o custo por quilo sobe, e é isso que a margem
    // precisa enxergar.
    expect(producedUnitCostCents(18_000, 6.84)).toBe(2632);
  });

  it('produção zerada não divide por zero', () => {
    expect(producedUnitCostCents(18_000, 0)).toBe(0);
  });
});
