/** Chaves de funcionalidade vendidas por plano. Toda feature nasce com a sua. */
export const FEATURES = {
  pos: 'pos',
  fiscal: 'fiscal',
  reports: 'reports',
  performance: 'performance',
  inventory: 'inventory',
  grid: 'grid',
  xmlImport: 'xml_import',
  tef: 'tef',
  finance: 'finance',
  cardContracts: 'card_contracts',
  bankReconciliation: 'bank_reconciliation',
  tables: 'tables',
  delivery: 'delivery',
  kiosk: 'kiosk',
  serviceOrders: 'service_orders',
  production: 'production',
  dynamicReports: 'dynamic_reports',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export interface PlanLimits {
  terminals: number;
  users: number;
  invoicesMonth: number;
  stores: number;
}

/** -1 significa ilimitado. */
export const UNLIMITED = -1;

export const PLAN_CATALOG = [
  {
    code: 'basico',
    name: 'Básico',
    monthlyCents: 19900,
    features: [FEATURES.pos, FEATURES.fiscal, FEATURES.reports, FEATURES.performance, FEATURES.inventory],
    limits: { terminals: 1, users: 3, invoicesMonth: 500, stores: 1 },
    overage: { invoiceCents: 150 },
  },
  {
    code: 'ideal',
    name: 'Ideal',
    monthlyCents: 39900,
    features: [
      FEATURES.pos, FEATURES.fiscal, FEATURES.reports, FEATURES.performance, FEATURES.inventory,
      FEATURES.grid, FEATURES.xmlImport, FEATURES.tef, FEATURES.finance,
    ],
    limits: { terminals: 1, users: 10, invoicesMonth: 3000, stores: 3 },
    overage: { invoiceCents: 150 },
  },
  {
    code: 'completo',
    name: 'Completo',
    monthlyCents: 69900,
    features: Object.values(FEATURES),
    limits: { terminals: UNLIMITED, users: UNLIMITED, invoicesMonth: UNLIMITED, stores: UNLIMITED },
    overage: {},
  },
] as const;
