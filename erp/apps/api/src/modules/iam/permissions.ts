/** Permissões granulares checadas no servidor. O front só esconde botão. */
export const PERMISSIONS = {
  saleCreate: 'sale.create',
  saleCancel: 'sale.cancel',
  saleDiscountAboveLimit: 'sale.discount.above_limit',
  cashOpen: 'cash.open',
  cashClose: 'cash.close',
  cashWithdrawal: 'cash.withdrawal',
  productManage: 'product.manage',
  storeManage: 'store.manage',
  productCostView: 'product.cost.view',
  priceUpdate: 'price.update',
  stockAdjust: 'stock.adjust',
  fiscalCancel: 'fiscal.cancel',
  /** Reenviar à SEFAZ uma nota que parou em rejeitada, depois de corrigir o cadastro. */
  fiscalRetry: 'fiscal.retry',
  fiscalView: 'fiscal.view',
  reportView: 'report.view',
  userManage: 'user.manage',
  tenantImpersonate: 'tenant.impersonate',
} as const;

export const ROLE_TEMPLATES = [
  { code: 'owner', name: 'Proprietário', permissions: ['*'] },
  {
    code: 'gerente',
    name: 'Gerente de loja',
    permissions: [
      PERMISSIONS.saleCreate, PERMISSIONS.saleCancel, PERMISSIONS.saleDiscountAboveLimit,
      PERMISSIONS.cashOpen, PERMISSIONS.cashClose, PERMISSIONS.cashWithdrawal,
      PERMISSIONS.stockAdjust, PERMISSIONS.reportView, PERMISSIONS.fiscalView,
      PERMISSIONS.fiscalCancel, PERMISSIONS.fiscalRetry,
      PERMISSIONS.productCostView, PERMISSIONS.productManage,
    ],
  },
  {
    code: 'caixa',
    name: 'Operador de caixa',
    permissions: [PERMISSIONS.saleCreate, PERMISSIONS.cashOpen],
  },
  {
    code: 'estoquista',
    name: 'Estoquista',
    permissions: [PERMISSIONS.stockAdjust, PERMISSIONS.productManage],
  },
  {
    code: 'financeiro',
    name: 'Financeiro',
    permissions: [
      PERMISSIONS.reportView, PERMISSIONS.fiscalView, PERMISSIONS.fiscalRetry,
      PERMISSIONS.productCostView,
    ],
  },
  { code: 'contador', name: 'Contador', permissions: [PERMISSIONS.fiscalView] },
] as const;
