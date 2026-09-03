/**
 * Ficha técnica — o que um item consome para existir.
 *
 * Um quiosque de sorvete expresso não estoca "pote de 300 ml": estoca calda,
 * sorvete a granel na máquina e embalagem vazia. O pote existe no momento da
 * venda, consumindo um pouco de cada. O mesmo vale para a pizza que consome
 * massa e queijo, para a porção que sai de um granel, para o suco que consome
 * fruta e copo. É sempre a mesma forma: um item de saída e os insumos que ele
 * come.
 *
 * Duas coisas distintas moram aqui e não devem se confundir:
 *
 *   - **Conversão de unidade** é física e exata: 1 L = 1000 ml, sempre.
 *   - **Rendimento** é do processo e varia: 6 L de calda viram ~7,2 kg de
 *     sorvete porque a máquina incorpora ar. Não é lei, é a máquina daquele
 *     dia — por isso o rendimento é declarado na ficha e *medido* na produção,
 *     nunca assumido como verdade.
 *
 * Este arquivo cuida só da explosão: dado o que foi vendido, o que sai do
 * estoque. Sem banco, para poder ser testado sozinho.
 */

export interface RecipeComponent {
  skuId: string;
  quantity: number;
}

export interface Recipe {
  outputSkuId: string;
  /** Quanto a ficha rende de uma execução. Os insumos são para esta quantidade. */
  outputQuantity: number;
  components: RecipeComponent[];
}

export class RecipeCycleError extends Error {
  constructor(readonly path: string[]) {
    super(`Ficha técnica circular: ${path.join(' → ')}`);
    this.name = 'RecipeCycleError';
  }
}

/** Profundidade que cobre combo → item → granel com folga. */
const MAX_DEPTH = 8;

/**
 * Transforma o que foi vendido no que sai do estoque.
 *
 * Um SKU sem ficha é folha: sai ele mesmo. Um SKU com ficha não sai — saem os
 * insumos dele, na proporção do que foi vendido. É o que faz o pote não
 * precisar existir no estoque enquanto a calda precisa.
 */
export function explodeRecipe(
  skuId: string,
  quantity: number,
  recipes: ReadonlyMap<string, Recipe>,
): RecipeComponent[] {
  const totals = new Map<string, number>();
  visit(skuId, quantity, recipes, totals, []);

  return [...totals.entries()]
    .map(([id, total]) => ({ skuId: id, quantity: round4(total) }))
    .filter((component) => component.quantity !== 0);
}

function visit(
  skuId: string,
  quantity: number,
  recipes: ReadonlyMap<string, Recipe>,
  totals: Map<string, number>,
  path: string[],
): void {
  const recipe = recipes.get(skuId);

  // Sem ficha, ou ficha vazia: o próprio item é o que sai do estoque.
  if (!recipe || recipe.components.length === 0) {
    totals.set(skuId, (totals.get(skuId) ?? 0) + quantity);
    return;
  }

  if (path.includes(skuId)) throw new RecipeCycleError([...path, skuId]);
  if (path.length >= MAX_DEPTH) {
    // Fundo demais quase sempre é cadastro errado. Parar aqui e baixar o item
    // é menos ruim do que estourar a pilha no meio de uma venda.
    totals.set(skuId, (totals.get(skuId) ?? 0) + quantity);
    return;
  }

  // A ficha rende `outputQuantity`; vendendo outra quantidade, tudo escala.
  const factor = quantity / recipe.outputQuantity;
  for (const component of recipe.components) {
    visit(component.skuId, component.quantity * factor, recipes, totals, [...path, skuId]);
  }
}

/**
 * Rendimento real de uma produção, em relação ao que a ficha prometia.
 *
 * 1 é o esperado; 0,95 é perda de 5%. É onde o dinheiro vaza em food service —
 * máquina mal regulada, calda que sobra no fundo, porção generosa demais — e
 * só aparece se alguém comparar o previsto com o que saiu de verdade.
 */
export function yieldRatio(producedQuantity: number, expectedQuantity: number): number | null {
  if (expectedQuantity <= 0) return null;
  return round4(producedQuantity / expectedQuantity);
}

/**
 * Custo unitário do que foi produzido.
 *
 * O custo dos insumos inteiro vai para o que saiu — inclusive a perda. Sorvete
 * que ficou no fundo do tanque foi pago, e quem paga é o pote vendido; diluir a
 * perda faria a margem parecer melhor do que é.
 */
export function producedUnitCostCents(
  totalInputCostCents: number,
  producedQuantity: number,
): number {
  if (producedQuantity <= 0) return 0;
  return Math.round(totalInputCostCents / producedQuantity);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
