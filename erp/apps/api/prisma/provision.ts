/**
 * Provisiona um cliente real: cria os planos (se ainda não existirem), o tenant
 * do CNPJ, os papéis, o usuário dono e a primeira loja com um terminal —
 * imprimindo o código de ativação para digitar no PDV.
 *
 * Diferente do seed, **não cria nenhum dado fictício**: nem produto, nem venda.
 * É o caminho de primeira subida em produção.
 *
 * Uso:
 *   npx ts-node --transpile-only apps/api/prisma/provision.ts \
 *     --cnpj 12345678000190 \
 *     --razao "Soul Muscle Alimentos LTDA" \
 *     --fantasia "Soul Muscle" \
 *     --email will@soulmuscle.com.br \
 *     --senha "uma senha forte" \
 *     --loja "Quiosque Shopping Norte" \
 *     [--plano completo] [--ie 110042490114] [--regime simples]
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

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
    features: ['pos', 'fiscal', 'reports', 'performance', 'inventory', 'grid', 'xml_import', 'finance'],
    limits: { terminals: 1, users: 10, invoicesMonth: 3000, stores: 3 },
    overage: { invoiceCents: 150 },
  },
  {
    code: 'completo',
    name: 'Completo',
    monthlyCents: 69900n,
    features: [
      'pos', 'fiscal', 'reports', 'performance', 'inventory', 'grid', 'xml_import', 'finance',
      'card_contracts', 'bank_reconciliation', 'tables', 'delivery', 'kiosk', 'service_orders',
      'production', 'dynamic_reports',
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
      'product.manage',
    ],
  },
  { code: 'caixa', name: 'Operador de caixa', permissions: ['sale.create', 'cash.open'] },
  { code: 'financeiro', name: 'Financeiro', permissions: ['report.view', 'fiscal.view', 'product.cost.view'] },
  { code: 'contador', name: 'Contador', permissions: ['fiscal.view'] },
];

interface Options {
  cnpj: string;
  razao: string;
  fantasia: string;
  email: string;
  senha: string;
  loja: string;
  plano: string;
  ie?: string;
  regime: string;
  terminal: string;
}

function parseArgs(): Options {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    args.set(process.argv[i]!.replace(/^--/, ''), process.argv[i + 1] ?? '');
  }

  const required = ['cnpj', 'razao', 'fantasia', 'email', 'senha', 'loja'] as const;
  const missing = required.filter((key) => !args.get(key));
  if (missing.length > 0) {
    console.error(`Faltam argumentos: ${missing.map((key) => `--${key}`).join(', ')}`);
    process.exit(1);
  }

  const cnpj = (args.get('cnpj') ?? '').replace(/\D/g, '');
  if (cnpj.length !== 14) {
    console.error('CNPJ deve ter 14 dígitos');
    process.exit(1);
  }
  if ((args.get('senha') ?? '').length < 8) {
    console.error('A senha do dono precisa de ao menos 8 caracteres');
    process.exit(1);
  }

  return {
    cnpj,
    razao: args.get('razao')!,
    fantasia: args.get('fantasia')!,
    email: args.get('email')!,
    senha: args.get('senha')!,
    loja: args.get('loja')!,
    plano: args.get('plano') ?? 'completo',
    ie: args.get('ie') || undefined,
    regime: args.get('regime') ?? 'simples',
    terminal: args.get('terminal') ?? 'PDV1',
  };
}

async function main(): Promise<void> {
  const options = parseArgs();

  const existing = await prisma.tenant.findUnique({ where: { cnpj: options.cnpj } });
  if (existing) {
    console.error(`Já existe um cliente com o CNPJ ${options.cnpj}: ${existing.tradeName}`);
    process.exit(1);
  }

  // Planos são do produto, não do cliente: criados uma vez e reaproveitados.
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        monthlyCents: plan.monthlyCents,
        features: plan.features,
        limits: plan.limits,
        overage: plan.overage,
      },
      update: { features: plan.features, limits: plan.limits },
    });
  }

  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: options.plano } });

  const tenant = await prisma.tenant.create({
    data: {
      planId: plan.id,
      legalName: options.razao,
      tradeName: options.fantasia,
      cnpj: options.cnpj,
      ie: options.ie ?? null,
      taxRegime: options.regime,
      crt: options.regime === 'simples' ? 1 : 3,
      status: 'active',
      address: {},
    },
  });

  const roles = await Promise.all(
    ROLES.map((role) =>
      prisma.role.create({
        data: { tenantId: tenant.id, code: role.code, name: role.name, permissions: [...role.permissions] },
      }),
    ),
  );
  const owner = roles.find((role) => role.code === 'owner')!;

  await prisma.appUser.create({
    data: {
      tenantId: tenant.id,
      name: options.email.split('@')[0]!,
      email: options.email,
      passwordHash: await argon2.hash(options.senha),
      roles: { create: { roleId: owner.id } },
    },
  });

  const store = await prisma.store.create({
    data: { tenantId: tenant.id, code: 'Q01', name: options.loja, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
  });

  const terminal = await prisma.terminal.create({
    data: {
      tenantId: tenant.id,
      storeId: store.id,
      code: options.terminal,
      fiscalSeries: 1,
      deviceToken: `soul-pdv-${store.code.toLowerCase()}-${randomBytes(4).toString('hex')}`,
    },
  });

  console.log(`
Cliente provisionado.

  Empresa    ${tenant.tradeName} · CNPJ ${tenant.cnpj}
  Plano      ${plan.name}
  Loja       ${store.name} (${store.code})
  Terminal   ${terminal.code} · série fiscal ${terminal.fiscalSeries}

  Retaguarda ${options.email}
  Ativação   ${terminal.deviceToken}

Próximos passos:
  1. entrar na retaguarda e cadastrar os produtos
  2. abrir o PDV em /pdv/ e digitar o código de ativação
  3. cadastrar os operadores com PIN
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
