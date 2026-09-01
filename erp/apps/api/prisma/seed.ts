/**
 * Semente de desenvolvimento: a rede Soul Muscle com três quiosques,
 * catálogo de sorvete e um histórico de vendas para o painel ter o que mostrar.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'basico',
    name: 'Básico',
    monthlyCents: 19900n,
    features: ['pos', 'fiscal', 'reports', 'performance', 'inventory'],
    limits: { terminals: 1, users: 3, invoicesMonth: 500, stores: 1 },
    overage: { invoiceCents: 150 },
  },
  {
    code: 'ideal',
    name: 'Ideal',
    monthlyCents: 39900n,
    features: ['pos', 'fiscal', 'reports', 'performance', 'inventory', 'grid', 'xml_import', 'tef', 'finance'],
    limits: { terminals: 1, users: 10, invoicesMonth: 3000, stores: 3 },
    overage: { invoiceCents: 150 },
  },
  {
    code: 'completo',
    name: 'Completo',
    monthlyCents: 69900n,
    features: [
      'pos', 'fiscal', 'reports', 'performance', 'inventory', 'grid', 'xml_import', 'tef',
      'finance', 'card_contracts', 'bank_reconciliation', 'tables', 'delivery', 'kiosk',
      'service_orders', 'production', 'dynamic_reports',
    ],
    limits: { terminals: -1, users: -1, invoicesMonth: -1, stores: -1 },
    overage: {},
  },
];

const ROLES = [
  { code: 'owner', name: 'Proprietário', permissions: ['*'] },
  {
    code: 'gerente',
    name: 'Gerente de loja',
    permissions: [
      'sale.create', 'sale.cancel', 'sale.discount.above_limit', 'cash.open', 'cash.close',
      'cash.withdrawal', 'stock.adjust', 'report.view', 'fiscal.view', 'product.cost.view',
    ],
  },
  { code: 'caixa', name: 'Operador de caixa', permissions: ['sale.create', 'cash.open'] },
];

const SABORES = [
  'Napolitano', 'Chocolate Belga', 'Morango', 'Flocos', 'Leite Ninho',
  'Pistache', 'Coco Queimado', 'Doce de Leite',
];

async function main(): Promise<void> {
  console.log('Semeando o Soul ERP...');
  await reset();

  const plans = await createPlans();
  const { tenant, stores, terminals } = await createTenant(plans.completo.id);
  const users = await createUsers(tenant.id);
  const catalog = await createCatalog(tenant.id, stores);
  await createStock(tenant.id, stores, catalog);
  await createSalesHistory(tenant.id, stores, terminals, users, catalog);

  console.log('\nPronto. Para entrar:');
  console.log('  retaguarda: will@soulmuscle.com.br / soulmuscle2026');
  console.log('  operador (PIN 1234): Camila');
  console.log(`  terminal PDV (deviceToken): ${terminals[0]!.deviceToken}`);
}

async function reset(): Promise<void> {
  // Ordem importa: dependências primeiro.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      sale_payment, sale_item, sale, fiscal_document, cash_movement, cash_session,
      stock_movement, stock_balance, stock_lot, barcode, price, sku, variant_value,
      variant_axis, product, category, tax_profile, terminal_alert, terminal_heartbeat,
      terminal, store, user_role, role, app_user, usage_counter, tenant_entitlement,
      tenant, plan, economic_group, audit_log
    RESTART IDENTITY CASCADE
  `);
}

async function createPlans() {
  const created = await Promise.all(
    PLANS.map((plan) =>
      prisma.plan.create({
        data: {
          code: plan.code,
          name: plan.name,
          monthlyCents: plan.monthlyCents,
          features: plan.features,
          limits: plan.limits,
          overage: plan.overage,
        },
      }),
    ),
  );
  return Object.fromEntries(created.map((plan) => [plan.code, plan])) as Record<string, { id: string }>;
}

async function createTenant(planId: string) {
  const group = await prisma.economicGroup.create({ data: { name: 'Grupo Soul Muscle' } });

  const tenant = await prisma.tenant.create({
    data: {
      economicGroupId: group.id,
      planId,
      legalName: 'Soul Muscle Alimentos Saudáveis LTDA',
      tradeName: 'Soul Muscle',
      cnpj: '12345678000190',
      ie: '110042490114',
      taxRegime: 'simples',
      crt: 1,
      status: 'active',
      address: {
        street: 'Av. das Nações Unidas',
        number: '1200',
        district: 'Brooklin',
        city: 'São Paulo',
        state: 'SP',
        zip: '04578000',
      },
    },
  });

  const storeSeeds = [
    { code: 'Q01', name: 'Quiosque Shopping Norte' },
    { code: 'Q02', name: 'Quiosque Shopping Sul' },
    { code: 'Q03', name: 'Quiosque Centro' },
  ];

  const stores = await Promise.all(
    storeSeeds.map((store) =>
      prisma.store.create({
        data: {
          tenantId: tenant.id,
          code: store.code,
          name: store.name,
          kind: 'kiosk',
          opensAt: '10:00',
          closesAt: '22:00',
        },
      }),
    ),
  );

  const terminals = await Promise.all(
    stores.map((store, index) =>
      prisma.terminal.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          code: 'PDV1',
          fiscalSeries: index + 1,
          deviceToken: `soul-pdv-${store.code.toLowerCase()}-${randomUUID().slice(0, 8)}`,
          appVersion: '1.0.0',
          lastSeenAt: new Date(),
        },
      }),
    ),
  );

  return { tenant, stores, terminals };
}

async function createUsers(tenantId: string) {
  const roles = await Promise.all(
    ROLES.map((role) =>
      prisma.role.create({
        data: { tenantId, code: role.code, name: role.name, permissions: [...role.permissions] },
      }),
    ),
  );
  const roleByCode = Object.fromEntries(roles.map((role) => [role.code, role]));

  const passwordHash = await argon2.hash('soulmuscle2026');
  const pinHash = await argon2.hash('1234');

  const owner = await prisma.appUser.create({
    data: {
      tenantId,
      name: 'Will Lopes',
      email: 'will@soulmuscle.com.br',
      passwordHash,
      pinHash,
      roles: { create: { roleId: roleByCode.owner!.id } },
    },
  });

  const operators = await Promise.all(
    ['Camila Souza', 'Rafael Lima', 'Bianca Alves'].map((name) =>
      prisma.appUser.create({
        data: {
          tenantId,
          name,
          pinHash,
          roles: { create: { roleId: roleByCode.caixa!.id } },
        },
      }),
    ),
  );

  return [owner, ...operators];
}

async function createCatalog(tenantId: string, stores: Array<{ id: string }>) {
  const categorias = await Promise.all(
    ['Sorvete', 'Açaí', 'Complementos', 'Bebidas'].map((name, index) =>
      prisma.category.create({ data: { tenantId, name, sortOrder: index } }),
    ),
  );
  const [sorvete, acai, complementos, bebidas] = categorias;

  const eixoSabor = await prisma.variantAxis.create({ data: { tenantId, name: 'Sabor' } });
  const valoresSabor = await Promise.all(
    SABORES.map((value, index) =>
      prisma.variantValue.create({ data: { axisId: eixoSabor.id, value, sortOrder: index } }),
    ),
  );

  const skus: Array<{ id: string; priceCents: number; soldByWeight: boolean; description: string }> = [];

  // Sorvete no peso — o carro-chefe do quiosque.
  const sorveteNoPeso = await prisma.product.create({
    data: {
      tenantId,
      categoryId: sorvete!.id,
      name: 'Sorvete no peso',
      unit: 'KG',
      soldByWeight: true,
      ncm: '21050010',
      cfop: '5102',
    },
  });
  skus.push(
    await createSku(tenantId, stores, {
      productId: sorveteNoPeso.id,
      code: '000010',
      description: 'Sorvete no peso',
      priceCents: 7990,
      barcode: null,
      soldByWeight: true,
    }),
  );

  const acaiNoPeso = await prisma.product.create({
    data: {
      tenantId,
      categoryId: acai!.id,
      name: 'Açaí no peso',
      unit: 'KG',
      soldByWeight: true,
      ncm: '21050010',
      cfop: '5102',
    },
  });
  skus.push(
    await createSku(tenantId, stores, {
      productId: acaiNoPeso.id,
      code: '000042',
      description: 'Açaí no peso',
      priceCents: 5990,
      barcode: null,
      soldByWeight: true,
    }),
  );

  // Pote de 1L com grade de sabores — usa os dois eixos do catálogo.
  const pote = await prisma.product.create({
    data: {
      tenantId,
      categoryId: sorvete!.id,
      name: 'Pote 1L',
      kind: 'grid',
      unit: 'UN',
      ncm: '21050010',
      cfop: '5102',
    },
  });
  for (const [index, sabor] of valoresSabor.entries()) {
    skus.push(
      await createSku(tenantId, stores, {
        productId: pote.id,
        code: `2000${String(index + 1).padStart(2, '0')}`,
        description: `Pote 1L ${sabor.value}`,
        priceCents: 3490,
        barcode: `789000000${String(index + 10).padStart(3, '0')}`,
        axis1ValueId: sabor.id,
      }),
    );
  }

  const avulsos = [
    { categoryId: complementos!.id, name: 'Casquinha', code: '000101', priceCents: 600, ncm: '19053100' },
    { categoryId: complementos!.id, name: 'Granola', code: '000102', priceCents: 300, ncm: '19041000' },
    { categoryId: complementos!.id, name: 'Calda de chocolate', code: '000103', priceCents: 400, ncm: '18069000' },
    { categoryId: complementos!.id, name: 'Whey no copo', code: '000104', priceCents: 1200, ncm: '22029900' },
    { categoryId: bebidas!.id, name: 'Água mineral 500ml', code: '000201', priceCents: 500, ncm: '22011000' },
    { categoryId: bebidas!.id, name: 'Refrigerante lata', code: '000202', priceCents: 700, ncm: '22021000' },
  ];

  for (const item of avulsos) {
    const product = await prisma.product.create({
      data: {
        tenantId,
        categoryId: item.categoryId,
        name: item.name,
        unit: 'UN',
        ncm: item.ncm,
        cfop: '5102',
      },
    });
    skus.push(
      await createSku(tenantId, stores, {
        productId: product.id,
        code: item.code,
        description: item.name,
        priceCents: item.priceCents,
        barcode: `789111${item.code}0`,
      }),
    );
  }

  return skus;
}

async function createSku(
  tenantId: string,
  stores: Array<{ id: string }>,
  input: {
    productId: string;
    code: string;
    description: string;
    priceCents: number;
    barcode: string | null;
    axis1ValueId?: string;
    soldByWeight?: boolean;
  },
) {
  const sku = await prisma.sku.create({
    data: {
      tenantId,
      productId: input.productId,
      code: input.code,
      description: input.description,
      axis1ValueId: input.axis1ValueId,
      avgCostCents: BigInt(Math.round(input.priceCents * 0.42)),
      trackLot: input.soldByWeight ?? false,
      minStock: new Prisma.Decimal(input.soldByWeight ? 5 : 10),
    },
  });

  if (input.barcode) {
    await prisma.barcode.create({ data: { tenantId, code: input.barcode, skuId: sku.id, kind: 'ean' } });
  }

  // Preço padrão do tenant; uma loja pode sobrescrever criando outra vigência.
  await prisma.price.create({
    data: { tenantId, skuId: sku.id, priceCents: BigInt(input.priceCents) },
  });

  return {
    id: sku.id,
    priceCents: input.priceCents,
    soldByWeight: input.soldByWeight ?? false,
    description: input.description,
  };
}

async function createStock(
  tenantId: string,
  stores: Array<{ id: string }>,
  skus: Array<{ id: string; soldByWeight: boolean }>,
) {
  for (const store of stores) {
    for (const sku of skus) {
      if (sku.soldByWeight) {
        // Produto por peso tem lote e validade — sorvete vence.
        const lot = await prisma.stockLot.create({
          data: {
            tenantId,
            skuId: sku.id,
            lotCode: `L${store.id.slice(0, 4)}${sku.id.slice(0, 4)}`.toUpperCase(),
            expiresAt: new Date(Date.now() + 90 * 86_400_000),
          },
        });
        await prisma.stockBalance.create({
          data: { tenantId, storeId: store.id, skuId: sku.id, lotId: lot.id, quantity: new Prisma.Decimal(60) },
        });
        continue;
      }

      await prisma.stockBalance.create({
        data: { tenantId, storeId: store.id, skuId: sku.id, quantity: new Prisma.Decimal(80) },
      });
    }
  }
}

async function createSalesHistory(
  tenantId: string,
  stores: Array<{ id: string; name: string }>,
  terminals: Array<{ id: string; storeId: string; fiscalSeries: number }>,
  users: Array<{ id: string }>,
  skus: Array<{ id: string; priceCents: number; soldByWeight: boolean; description: string }>,
) {
  const operators = users.slice(1);
  let saleNumber = new Map<string, number>();

  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    for (const terminal of terminals) {
      const day = new Date();
      day.setDate(day.getDate() - daysAgo);
      day.setHours(10, 0, 0, 0);

      const session = await prisma.cashSession.create({
        data: {
          tenantId,
          storeId: terminal.storeId,
          terminalId: terminal.id,
          openedById: operators[0]!.id,
          openedAt: day,
          openingFloatCents: 10_000n,
          status: daysAgo === 0 ? 'open' : 'closed',
          closedAt: daysAgo === 0 ? null : new Date(day.getTime() + 12 * 3_600_000),
        },
      });

      const salesToday = 18 + Math.floor(Math.random() * 22);
      for (let i = 0; i < salesToday; i += 1) {
        const occurredAt = new Date(day.getTime() + hourOfDay() * 3_600_000);
        if (occurredAt > new Date()) continue;

        const items = pickItems(skus);
        const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
        const next = (saleNumber.get(terminal.storeId) ?? 0) + 1;
        saleNumber.set(terminal.storeId, next);

        await prisma.sale.create({
          data: {
            id: randomUUID(),
            tenantId,
            storeId: terminal.storeId,
            terminalId: terminal.id,
            sessionId: session.id,
            number: BigInt(next),
            operatorId: operators[i % operators.length]!.id,
            grossCents: BigInt(totalCents),
            totalCents: BigInt(totalCents),
            costCents: BigInt(Math.round(totalCents * 0.42)),
            occurredAt,
            receivedAt: occurredAt,
            items: {
              create: items.map((item, index) => ({
                tenantId,
                lineNumber: index + 1,
                skuId: item.skuId,
                description: item.description,
                quantity: new Prisma.Decimal(item.quantity),
                unit: item.unit,
                unitPriceCents: BigInt(item.unitPriceCents),
                totalCents: BigInt(item.totalCents),
                weighed: item.unit === 'KG',
              })),
            },
            documents: {
              // Histórico já nasce com a nota autorizada: é o estado normal de
              // uma venda antiga, e é o que o painel fiscal deve mostrar.
              create: {
                tenantId,
                storeId: terminal.storeId,
                model: 65,
                series: terminal.fiscalSeries,
                number: BigInt(next),
                accessKey: fakeAccessKey(terminal.fiscalSeries, next),
                status: 'authorized',
                provider: 'fake',
                environment: 2,
                authorizedAt: occurredAt,
                payload: {},
              },
            },
            payments: {
              create: [randomPayment(totalCents)].map((payment) => ({
                tenantId,
                method: payment.method,
                amountCents: BigInt(payment.amountCents),
                changeCents: BigInt(payment.changeCents),
                captured: false,
                cardBrand: payment.cardBrand,
                installments: 1,
              })),
            },
          },
        });
      }
    }
  }
}

function hourOfDay(): number {
  // Movimento concentrado entre 14h e 21h, como num quiosque de shopping.
  const weights = [
    [10, 2], [11, 3], [12, 6], [13, 7], [14, 9], [15, 10],
    [16, 11], [17, 10], [18, 9], [19, 12], [20, 11], [21, 6],
  ] as const;
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let ticket = Math.random() * total;
  for (const [hour, weight] of weights) {
    ticket -= weight;
    if (ticket <= 0) return hour - 10 + Math.random();
  }
  return 12;
}

function pickItems(skus: Array<{ id: string; priceCents: number; soldByWeight: boolean; description: string }>) {
  const count = 1 + Math.floor(Math.random() * 3);
  const items: Array<{
    skuId: string;
    description: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    totalCents: number;
  }> = [];

  for (let i = 0; i < count; i += 1) {
    const sku = skus[Math.floor(Math.random() * skus.length)]!;
    const quantity = sku.soldByWeight ? round3(0.15 + Math.random() * 0.5) : 1 + Math.floor(Math.random() * 2);
    items.push({
      skuId: sku.id,
      description: sku.description,
      quantity,
      unit: sku.soldByWeight ? 'KG' : 'UN',
      unitPriceCents: sku.priceCents,
      totalCents: Math.round(sku.priceCents * quantity),
    });
  }
  return items;
}

function randomPayment(totalCents: number) {
  const roll = Math.random();
  if (roll < 0.45) return { method: 'debit', amountCents: totalCents, changeCents: 0, cardBrand: 'visa' };
  if (roll < 0.75) return { method: 'credit', amountCents: totalCents, changeCents: 0, cardBrand: 'master' };
  if (roll < 0.9) return { method: 'pix', amountCents: totalCents, changeCents: 0, cardBrand: null };
  const tendered = Math.ceil(totalCents / 1000) * 1000;
  return { method: 'cash', amountCents: tendered, changeCents: tendered - totalCents, cardBrand: null };
}

/** Chave de acesso simulada: 44 dígitos únicos, só para o ambiente de teste. */
let fiscalSequence = 0;
function fakeAccessKey(series: number, number: number): string {
  fiscalSequence += 1;
  const body = `${String(series).padStart(3, '0')}${String(number).padStart(9, '0')}${String(fiscalSequence).padStart(10, '0')}`;
  return `3526091234567800019065${body}`.padEnd(44, '0').slice(0, 44);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
