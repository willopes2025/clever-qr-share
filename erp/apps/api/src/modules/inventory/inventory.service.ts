import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError } from '../../common/errors/domain-error';
import { allocateAvailable, type LotBalance } from './fefo';
import { weightedAverageCost } from './average-cost';
import { explodeRecipe, producedUnitCostCents, yieldRatio, type Recipe as BomRecipe } from './bom';

export interface StockConsumption {
  skuId: string;
  quantity: number;
  unitCostCents: bigint;
}

export interface StockShortfall {
  skuId: string;
  /** Quanto faltou em estoque no momento da venda. */
  quantity: number;
}

export interface ReceiptItem {
  skuId: string;
  quantity: number;
  unitCostCents: number;
  /** Lote do fabricante. Sorvete tem validade: sem lote não há FEFO. */
  lotCode?: string | null;
  expiresAt?: string | null;
}

export interface ReceiveInput {
  tenantId: string;
  storeId: string;
  userId: string;
  /** Nota do fornecedor, quando houver. Fica no motivo do movimento. */
  document?: string | null;
  items: ReceiptItem[];
}

export interface CountItem {
  skuId: string;
  /** Quanto foi contado na prateleira, não a diferença. */
  countedQuantity: number;
}

export interface CountInput {
  tenantId: string;
  storeId: string;
  userId: string;
  reason: string;
  items: CountItem[];
}

/** O que a contagem encontrou de diferente do que o sistema achava. */
export interface CountDifference {
  skuId: string;
  description: string;
  expected: number;
  counted: number;
  difference: number;
}

export interface ProduceInput {
  tenantId: string;
  storeId: string;
  userId: string;
  outputSkuId: string;
  /** O que foi medido na saída — não o que a ficha prometia. */
  producedQuantity: number;
  /** Insumos realmente usados. Vazio: a ficha decide, pelo número de bateladas. */
  inputs?: Array<{ skuId: string; quantity: number }>;
  /**
   * Quantas vezes a receita foi executada. Serve a quem não quer digitar
   * insumo: "rodei duas bateladas e saiu isto".
   */
  batches?: number;
  notes?: string | null;
}

export interface ProductionResult {
  orderId: string;
  producedQuantity: number;
  expectedQuantity: number;
  /** 1 = saiu o previsto; 0,95 = 5% de perda. Nulo quando não há ficha. */
  yieldRatio: number | null;
  inputCostCents: number;
  unitCostCents: number;
}

export interface ConsumeSaleInput {
  tenantId: string;
  storeId: string;
  saleId: string;
  userId: string;
  occurredAt: Date;
  items: StockConsumption[];
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Baixa de estoque da venda.
 *
 * Roda sempre dentro da mesma transação que grava a venda — estoque baixado sem
 * venda gravada (ou o contrário) é divergência que ninguém consegue explicar depois.
 *
 * Falta de estoque **não recusa a venda**. No balcão a venda já aconteceu: o
 * cliente pagou e saiu com o pote. Recusar o registro não desfaz nada — só faz
 * perder o faturamento e a nota fiscal daquela venda, que é o oposto do que o
 * sistema existe para fazer. O saldo fica negativo, que é a verdade do que
 * aconteceu, e a falta volta como aviso para quem cuida do inventário.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async consumeForSale(tx: TransactionClient, input: ConsumeSaleInput): Promise<StockShortfall[]> {
    const shortfalls: StockShortfall[] = [];
    // O que sai do estoque não é o que foi vendido: um pote de sorvete tira do
    // granel e da embalagem, e nenhum dos dois é o pote.
    const items = await this.resolveComponents(tx, input.tenantId, input.items);

    for (const item of items) {
      const balances = await this.loadBalances(tx, input.tenantId, input.storeId, item.skuId);
      const { allocations, shortfall } = allocateAvailable(balances, item.quantity, {
        now: input.occurredAt,
      });

      // O que faltou sai do saldo sem lote: é lá que o negativo fica visível
      // para o acerto de inventário, sem sujar a validade de um lote real.
      if (shortfall > 0) {
        shortfalls.push({ skuId: item.skuId, quantity: shortfall });
        allocations.push({ lotId: null, quantity: shortfall });
      }

      for (const allocation of allocations) {
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId: allocation.lotId,
          quantity: -allocation.quantity,
          unitCostCents: item.unitCostCents,
          kind: 'sale',
          refType: 'sale',
          refId: input.saleId,
          userId: input.userId,
          occurredAt: input.occurredAt,
        });
      }
    }

    return shortfalls;
  }

  /**
   * Devolução: desfaz a baixa da venda.
   *
   * Passa pela mesma ficha técnica da saída — senão cancelar a venda de um pote
   * devolveria "pote" ao estoque, criando do nada um item que nunca existiu e
   * deixando o granel e a embalagem a menos para sempre.
   *
   * Volta para o saldo sem lote: de qual lote saiu cada grama não é rastreado,
   * e devolver a um lote específico seria inventar dado.
   */
  async returnToStock(
    tx: TransactionClient,
    input: ConsumeSaleInput & { originalSaleId: string },
  ): Promise<void> {
    const items = await this.resolveComponents(tx, input.tenantId, input.items);

    for (const item of items) {
      await this.applyMovement(tx, {
        tenantId: input.tenantId,
        storeId: input.storeId,
        skuId: item.skuId,
        lotId: null,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        kind: 'return',
        refType: 'sale',
        refId: input.originalSaleId,
        reason: 'Estorno de venda cancelada',
        userId: input.userId,
        occurredAt: input.occurredAt,
      });
    }
  }

  /**
   * Troca o que foi vendido pelo que sai do estoque, seguindo a ficha técnica.
   *
   * Carrega só as fichas de montagem (`assembly`): as de produção têm baixa
   * própria, no apontamento, e explodir uma delas aqui faria a calda sair duas
   * vezes — uma na produção e outra na venda.
   *
   * Sem nenhuma ficha cadastrada, nada muda: cada item vendido baixa a si
   * mesmo, que é o comportamento de quem revende produto pronto.
   */
  private async resolveComponents(
    tx: TransactionClient,
    tenantId: string,
    items: StockConsumption[],
  ): Promise<StockConsumption[]> {
    const recipes = await this.loadAssemblyRecipes(tx, tenantId);
    if (recipes.size === 0) return items;

    const merged = new Map<string, StockConsumption>();
    for (const item of items) {
      for (const component of explodeRecipe(item.skuId, item.quantity, recipes)) {
        const current = merged.get(component.skuId);
        merged.set(component.skuId, {
          skuId: component.skuId,
          quantity: (current?.quantity ?? 0) + component.quantity,
          // O custo congelado da venda é do item vendido; o insumo tem o seu.
          unitCostCents: current?.unitCostCents ?? 0n,
        });
      }
    }

    // O custo de cada insumo é o custo médio dele, não o do item vendido.
    const costs = await tx.sku.findMany({
      where: { tenantId, id: { in: [...merged.keys()] } },
      select: { id: true, avgCostCents: true },
    });
    for (const cost of costs) {
      const line = merged.get(cost.id);
      if (line) line.unitCostCents = cost.avgCostCents;
    }

    return [...merged.values()];
  }

  /** Fichas de montagem do tenant, no formato que a explosão entende. */
  private async loadAssemblyRecipes(
    tx: TransactionClient,
    tenantId: string,
  ): Promise<Map<string, BomRecipe>> {
    const rows = await tx.recipe.findMany({
      where: { tenantId, active: true, kind: 'assembly' },
      include: { items: true },
    });

    return new Map(
      rows.map((row) => [
        row.outputSkuId,
        {
          outputSkuId: row.outputSkuId,
          outputQuantity: Number(row.outputQuantity),
          components: row.items.map((item) => ({
            skuId: item.skuId,
            quantity: Number(item.quantity),
          })),
        },
      ]),
    );
  }

  /**
   * Entrada de mercadoria.
   *
   * É a porta que faltava: sem ela o estoque só sabia descer, e o saldo de
   * qualquer loja virava ficção depois da primeira venda.
   *
   * Atualiza o custo médio do SKU junto, porque é dele que sai a margem — e
   * margem calculada sobre custo velho engana mais do que não ter margem.
   */
  async receive(input: ReceiveInput): Promise<{ items: number; totalCostCents: number }> {
    if (input.items.length === 0) {
      throw new ConflictError('EMPTY_RECEIPT', 'A entrada precisa de ao menos um item');
    }

    const occurredAt = new Date();
    const reason = input.document ? `Entrada · nota ${input.document}` : 'Entrada de mercadoria';
    let totalCostCents = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw new ConflictError('INVALID_QUANTITY', 'Quantidade de entrada deve ser positiva', {
            skuId: item.skuId,
          });
        }

        const lotId = await this.resolveLot(tx, input.tenantId, item);
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId,
          quantity: item.quantity,
          unitCostCents: BigInt(item.unitCostCents),
          kind: 'purchase',
          refType: input.document ? 'supplier_note' : null,
          refId: input.document ?? null,
          reason,
          userId: input.userId,
          occurredAt,
        });

        await this.updateAverageCost(tx, input.tenantId, item);
        totalCostCents += item.unitCostCents * item.quantity;
      }
    });

    return { items: input.items.length, totalCostCents: Math.round(totalCostCents) };
  }

  /**
   * Apontamento de produção.
   *
   * Consome os insumos e cria o produzido, num movimento só. O que importa
   * aqui é a diferença entre o que a ficha prometia e o que saiu de verdade:
   * 6 L de calda deveriam render 7,2 kg de sorvete, e a máquina daquele dia
   * deu 6,84. Essa diferença é onde o dinheiro vaza em food service, e ela só
   * existe se alguém medir a saída em vez de confiar na receita.
   *
   * O custo dos insumos vai inteiro para o que saiu, perda incluída — sorvete
   * que ficou no fundo do tanque foi pago, e quem paga é o pote vendido.
   */
  async produce(input: ProduceInput): Promise<ProductionResult> {
    if (input.producedQuantity <= 0) {
      throw new ConflictError('INVALID_QUANTITY', 'A quantidade produzida deve ser positiva');
    }

    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findFirst({
        where: { tenantId: input.tenantId, outputSkuId: input.outputSkuId, active: true },
        include: { items: true },
      });

      // Escalar a receita pelo produzido seria circular: o previsto sairia igual
      // ao produzido e o rendimento daria sempre 100%, apagando justamente a
      // medição que a produção existe para fazer. Quem não informa insumo
      // informa bateladas — e uma é o padrão.
      const consumed = input.inputs?.length
        ? input.inputs
        : this.inputsFromRecipe(recipe, input.batches ?? 1);

      if (consumed.length === 0) {
        throw new ConflictError(
          'NO_RECIPE',
          'Sem ficha técnica, informe os insumos consumidos na produção',
          { outputSkuId: input.outputSkuId },
        );
      }

      // O previsto vem da ficha aplicada aos insumos que foram mesmo usados —
      // é o que torna a comparação honesta quando alguém põe 5 L em vez de 6.
      const expectedQuantity = this.expectedOutput(recipe, consumed, input.producedQuantity);
      const occurredAt = new Date();
      let inputCostCents = 0;

      const order = await tx.productionOrder.create({
        data: {
          tenantId: input.tenantId,
          storeId: input.storeId,
          outputSkuId: input.outputSkuId,
          recipeId: recipe?.id ?? null,
          expectedQuantity: new Prisma.Decimal(expectedQuantity),
          producedQuantity: new Prisma.Decimal(input.producedQuantity),
          notes: input.notes ?? null,
          userId: input.userId,
          occurredAt,
        },
        select: { id: true },
      });

      for (const item of consumed) {
        if (item.quantity <= 0) {
          throw new ConflictError('INVALID_QUANTITY', 'Consumo de insumo deve ser positivo', {
            skuId: item.skuId,
          });
        }

        const sku = await tx.sku.findFirst({
          where: { id: item.skuId, tenantId: input.tenantId },
          select: { avgCostCents: true },
        });
        if (!sku) {
          throw new ConflictError('SKU_NOT_FOUND', 'Insumo não encontrado', { skuId: item.skuId });
        }

        const unitCost = Number(sku.avgCostCents);
        inputCostCents += unitCost * item.quantity;

        await tx.productionOrderItem.create({
          data: {
            tenantId: input.tenantId,
            orderId: order.id,
            skuId: item.skuId,
            quantity: new Prisma.Decimal(item.quantity),
            unitCostCents: BigInt(Math.round(unitCost)),
          },
        });

        // A baixa do insumo não recusa por falta, como a da venda: a produção
        // já aconteceu na máquina, e negar o registro não desfaz nada.
        const balances = await this.loadBalances(tx, input.tenantId, input.storeId, item.skuId);
        const { allocations, shortfall } = allocateAvailable(balances, item.quantity, {
          now: occurredAt,
        });
        if (shortfall > 0) allocations.push({ lotId: null, quantity: shortfall });

        for (const allocation of allocations) {
          await this.applyMovement(tx, {
            tenantId: input.tenantId,
            storeId: input.storeId,
            skuId: item.skuId,
            lotId: allocation.lotId,
            quantity: -allocation.quantity,
            unitCostCents: BigInt(Math.round(unitCost)),
            kind: 'production_out',
            refType: 'production',
            refId: order.id,
            reason: 'Consumo de produção',
            userId: input.userId,
            occurredAt,
          });
        }
      }

      inputCostCents = Math.round(inputCostCents);
      const unitCostCents = producedUnitCostCents(inputCostCents, input.producedQuantity);

      await this.applyMovement(tx, {
        tenantId: input.tenantId,
        storeId: input.storeId,
        skuId: input.outputSkuId,
        lotId: null,
        quantity: input.producedQuantity,
        unitCostCents: BigInt(unitCostCents),
        kind: 'production_in',
        refType: 'production',
        refId: order.id,
        reason: 'Produção',
        userId: input.userId,
        occurredAt,
      });

      await this.updateAverageCost(tx, input.tenantId, {
        skuId: input.outputSkuId,
        quantity: input.producedQuantity,
        unitCostCents,
      });

      await tx.productionOrder.update({
        where: { id: order.id },
        data: { inputCostCents: BigInt(inputCostCents) },
      });

      return {
        orderId: order.id,
        producedQuantity: input.producedQuantity,
        expectedQuantity,
        yieldRatio: yieldRatio(input.producedQuantity, expectedQuantity),
        inputCostCents,
        unitCostCents,
      };
    });
  }

  /** Insumos de N execuções da receita, do jeito que ela está cadastrada. */
  private inputsFromRecipe(
    recipe: { outputQuantity: Prisma.Decimal; items: Array<{ skuId: string; quantity: Prisma.Decimal }> } | null,
    batches: number,
  ): Array<{ skuId: string; quantity: number }> {
    if (!recipe || recipe.items.length === 0) return [];
    return recipe.items.map((item) => ({
      skuId: item.skuId,
      quantity: round4(Number(item.quantity) * batches),
    }));
  }

  /**
   * Quanto a ficha esperaria dos insumos que foram realmente usados.
   *
   * Usa o insumo mais restritivo — quem produz sorvete com metade da calda não
   * deveria ver o rendimento como se tivesse usado a receita inteira.
   */
  private expectedOutput(
    recipe: { outputQuantity: Prisma.Decimal; items: Array<{ skuId: string; quantity: Prisma.Decimal }> } | null,
    consumed: Array<{ skuId: string; quantity: number }>,
    fallback: number,
  ): number {
    if (!recipe || recipe.items.length === 0) return fallback;

    const ratios = recipe.items
      .map((item) => {
        const used = consumed.find((line) => line.skuId === item.skuId);
        const planned = Number(item.quantity);
        return used && planned > 0 ? used.quantity / planned : null;
      })
      .filter((ratio): ratio is number => ratio !== null);

    if (ratios.length === 0) return fallback;
    return round4(Math.min(...ratios) * Number(recipe.outputQuantity));
  }

  /**
   * Contagem de inventário.
   *
   * Recebe o que foi contado na prateleira, não a diferença — quem conta não
   * deveria precisar fazer subtração de cabeça. O sistema calcula a diferença,
   * grava o ajuste e devolve o que estava errado, que é o dado que interessa.
   */
  async count(input: CountInput): Promise<CountDifference[]> {
    const differences: CountDifference[] = [];
    const occurredAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        if (item.countedQuantity < 0) {
          throw new ConflictError('INVALID_QUANTITY', 'Contagem não pode ser negativa', {
            skuId: item.skuId,
          });
        }

        const sku = await tx.sku.findFirst({
          where: { id: item.skuId, tenantId: input.tenantId },
          select: { description: true },
        });
        if (!sku) {
          throw new ConflictError('SKU_NOT_FOUND', 'Produto não encontrado', { skuId: item.skuId });
        }

        const balances = await this.loadBalances(tx, input.tenantId, input.storeId, item.skuId);
        const expected = balances.reduce((total, balance) => total + balance.quantity, 0);
        const difference = round4(item.countedQuantity - expected);
        if (difference === 0) continue;

        // O acerto sai do saldo sem lote: a contagem diz o total da prateleira,
        // não de qual lote sobrou — atribuir a um lote real seria inventar dado.
        await this.applyMovement(tx, {
          tenantId: input.tenantId,
          storeId: input.storeId,
          skuId: item.skuId,
          lotId: null,
          quantity: difference,
          unitCostCents: 0n,
          kind: 'adjust',
          refType: 'count',
          refId: null,
          reason: input.reason,
          userId: input.userId,
          occurredAt,
        });

        differences.push({
          skuId: item.skuId,
          description: sku.description,
          expected,
          counted: item.countedQuantity,
          difference,
        });
      }
    });

    return differences;
  }

  async adjust(input: {
    tenantId: string;
    storeId: string;
    skuId: string;
    quantity: number;
    reason: string;
    userId: string;
  }): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.applyMovement(tx, {
        ...input,
        lotId: null,
        unitCostCents: 0n,
        kind: 'adjust',
        refType: null,
        refId: null,
        occurredAt: new Date(),
      }),
    );
  }

  /**
   * Saldo da loja, do jeito que a pessoa que repõe precisa ver: o que está
   * negativo primeiro, depois o que furou o mínimo, depois o resto.
   */
  async balances(
    tenantId: string,
    storeId: string,
    search?: string,
  ): Promise<
    Array<{
      skuId: string;
      code: string;
      description: string;
      quantity: number;
      minStock: number;
      avgCostCents: number;
      belowMinimum: boolean;
      negative: boolean;
      nextExpiry: string | null;
    }>
  > {
    const skus = await this.prisma.sku.findMany({
      where: {
        tenantId,
        active: true,
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: 'insensitive' as const } },
                { code: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { balances: { where: { storeId }, include: { lot: true } } },
      take: 500,
    });

    return skus
      .map((sku) => {
        const quantity = round4(
          sku.balances.reduce((total, balance) => total + Number(balance.quantity), 0),
        );
        const minStock = Number(sku.minStock);
        const expiries = sku.balances
          .filter((balance) => Number(balance.quantity) > 0 && balance.lot?.expiresAt)
          .map((balance) => balance.lot!.expiresAt!)
          .sort((a, b) => a.getTime() - b.getTime());

        return {
          skuId: sku.id,
          code: sku.code,
          description: sku.description,
          quantity,
          minStock,
          avgCostCents: Number(sku.avgCostCents),
          belowMinimum: minStock > 0 && quantity < minStock,
          negative: quantity < 0,
          nextExpiry: expiries[0]?.toISOString().slice(0, 10) ?? null,
        };
      })
      .sort((a, b) => {
        // Negativo antes de tudo: é erro de cadastro esperando conserto.
        if (a.negative !== b.negative) return a.negative ? -1 : 1;
        if (a.belowMinimum !== b.belowMinimum) return a.belowMinimum ? -1 : 1;
        return a.description.localeCompare(b.description);
      });
  }

  /** Extrato de um produto na loja: de onde veio e para onde foi cada unidade. */
  async movements(tenantId: string, storeId: string, skuId: string, limit = 100) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { tenantId, storeId, skuId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 500),
      include: { lot: { select: { lotCode: true, expiresAt: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      quantity: Number(row.quantity),
      unitCostCents: Number(row.unitCostCents),
      reason: row.reason,
      lotCode: row.lot?.lotCode ?? null,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  /** Ficha técnica de um item, para a tela de cadastro. */
  async recipeFor(tenantId: string, outputSkuId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { tenantId, outputSkuId },
      include: { items: { include: { sku: { select: { code: true, description: true, unit: true } } } } },
    });
    if (!recipe) return null;

    return {
      id: recipe.id,
      outputSkuId: recipe.outputSkuId,
      kind: recipe.kind,
      outputQuantity: Number(recipe.outputQuantity),
      notes: recipe.notes,
      active: recipe.active,
      items: recipe.items.map((item) => ({
        skuId: item.skuId,
        code: item.sku.code,
        description: item.sku.description,
        unit: item.sku.unit,
        quantity: Number(item.quantity),
      })),
    };
  }

  /**
   * Grava a ficha inteira de uma vez.
   *
   * Substituir os insumos em bloco evita o estado meio-editado que apareceria
   * numa edição item a item — ficha pela metade produz baixa errada.
   */
  async saveRecipe(input: {
    tenantId: string;
    outputSkuId: string;
    kind: 'assembly' | 'production';
    outputQuantity: number;
    notes?: string | null;
    items: Array<{ skuId: string; quantity: number }>;
  }): Promise<void> {
    if (input.outputQuantity <= 0) {
      throw new ConflictError('INVALID_QUANTITY', 'O rendimento da ficha deve ser positivo');
    }
    if (input.items.some((item) => item.skuId === input.outputSkuId)) {
      throw new ConflictError('RECIPE_CYCLE', 'Um item não pode ser insumo de si mesmo');
    }

    await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.upsert({
        where: { outputSkuId: input.outputSkuId },
        create: {
          tenantId: input.tenantId,
          outputSkuId: input.outputSkuId,
          kind: input.kind,
          outputQuantity: new Prisma.Decimal(input.outputQuantity),
          notes: input.notes ?? null,
        },
        update: {
          kind: input.kind,
          outputQuantity: new Prisma.Decimal(input.outputQuantity),
          notes: input.notes ?? null,
          active: true,
        },
        select: { id: true },
      });

      await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
      for (const item of input.items) {
        await tx.recipeItem.create({
          data: {
            tenantId: input.tenantId,
            recipeId: recipe.id,
            skuId: item.skuId,
            quantity: new Prisma.Decimal(item.quantity),
          },
        });
      }
    });
  }

  async removeRecipe(tenantId: string, outputSkuId: string): Promise<void> {
    await this.prisma.recipe.deleteMany({ where: { tenantId, outputSkuId } });
  }

  /** Histórico de produção da loja, com o rendimento de cada apontamento. */
  async productions(tenantId: string, storeId: string, limit = 50) {
    const orders = await this.prisma.productionOrder.findMany({
      where: { tenantId, storeId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        outputSku: { select: { description: true, unit: true } },
        items: { include: { sku: { select: { description: true, unit: true } } } },
      },
    });

    return orders.map((order) => {
      const produced = Number(order.producedQuantity);
      const expected = Number(order.expectedQuantity);
      return {
        id: order.id,
        outputDescription: order.outputSku.description,
        outputUnit: order.outputSku.unit,
        producedQuantity: produced,
        expectedQuantity: expected,
        yieldRatio: yieldRatio(produced, expected),
        inputCostCents: Number(order.inputCostCents),
        unitCostCents: producedUnitCostCents(Number(order.inputCostCents), produced),
        notes: order.notes,
        occurredAt: order.occurredAt.toISOString(),
        inputs: order.items.map((item) => ({
          description: item.sku.description,
          unit: item.sku.unit,
          quantity: Number(item.quantity),
        })),
      };
    });
  }

  /** Acha ou cria o lote da entrada. Sem código de lote, o saldo é o sem-lote. */
  private async resolveLot(
    tx: TransactionClient,
    tenantId: string,
    item: ReceiptItem,
  ): Promise<string | null> {
    const lotCode = item.lotCode?.trim();
    if (!lotCode) return null;

    const existing = await tx.stockLot.findFirst({ where: { tenantId, skuId: item.skuId, lotCode } });
    if (existing) return existing.id;

    const created = await tx.stockLot.create({
      data: {
        tenantId,
        skuId: item.skuId,
        lotCode,
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
      },
    });
    return created.id;
  }

  /**
   * Custo médio ponderado do SKU.
   *
   * Com saldo zerado ou negativo não há média a ponderar — o custo da entrada
   * passa a ser o custo, senão o negativo puxaria a média para um número sem
   * sentido, às vezes negativo.
   */
  private async updateAverageCost(
    tx: TransactionClient,
    tenantId: string,
    item: ReceiptItem,
  ): Promise<void> {
    const sku = await tx.sku.findFirst({
      where: { id: item.skuId, tenantId },
      select: { avgCostCents: true },
    });
    if (!sku) {
      throw new ConflictError('SKU_NOT_FOUND', 'Produto não encontrado', { skuId: item.skuId });
    }

    // Saldo depois da entrada, somando todas as lojas: o custo é do produto,
    // não da prateleira.
    const totals = await tx.stockBalance.aggregate({
      where: { tenantId, skuId: item.skuId },
      _sum: { quantity: true },
    });
    const after = Number(totals._sum.quantity ?? 0);
    const before = round4(after - item.quantity);

    const average = weightedAverageCost({
      quantityBefore: before,
      averageCostCentsBefore: Number(sku.avgCostCents),
      quantityIn: item.quantity,
      unitCostCentsIn: item.unitCostCents,
    });

    await tx.sku.update({ where: { id: item.skuId }, data: { avgCostCents: BigInt(average) } });
  }

  private async loadBalances(
    tx: TransactionClient,
    tenantId: string,
    storeId: string,
    skuId: string,
  ): Promise<LotBalance[]> {
    const rows = await tx.stockBalance.findMany({
      where: { tenantId, storeId, skuId },
      include: { lot: true },
    });
    if (rows.length === 0) return [{ lotId: null, quantity: 0, expiresAt: null }];

    return rows.map((row) => ({
      lotId: row.lotId,
      quantity: Number(row.quantity),
      expiresAt: row.lot?.expiresAt ?? null,
    }));
  }

  private async applyMovement(
    tx: TransactionClient,
    movement: {
      tenantId: string;
      storeId: string;
      skuId: string;
      lotId: string | null;
      quantity: number;
      unitCostCents: bigint;
      kind: string;
      refType: string | null;
      refId: string | null;
      reason?: string;
      userId: string;
      occurredAt: Date;
    },
  ): Promise<void> {
    await tx.stockMovement.create({
      data: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
        kind: movement.kind,
        quantity: new Prisma.Decimal(movement.quantity),
        unitCostCents: movement.unitCostCents,
        refType: movement.refType,
        refId: movement.refId,
        reason: movement.reason,
        userId: movement.userId,
        occurredAt: movement.occurredAt,
      },
    });

    const balance = await tx.stockBalance.findFirst({
      where: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
      },
    });

    if (balance) {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { increment: new Prisma.Decimal(movement.quantity) } },
      });
      return;
    }

    await tx.stockBalance.create({
      data: {
        tenantId: movement.tenantId,
        storeId: movement.storeId,
        skuId: movement.skuId,
        lotId: movement.lotId,
        quantity: new Prisma.Decimal(movement.quantity),
      },
    });
  }
}

/** Quantidade é Decimal(14,4) no banco; arredondar evita ruído de ponto flutuante. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
