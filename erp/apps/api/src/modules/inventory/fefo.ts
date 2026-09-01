/**
 * Consumo de lote por FEFO — *first expired, first out*.
 *
 * Sorvete tem validade. Vender lote vencido é problema sanitário, não detalhe
 * de sistema: por isso a regra é pura, testada e usada por toda baixa de estoque.
 */
export interface LotBalance {
  lotId: string | null;
  quantity: number;
  expiresAt: Date | null;
}

export interface LotAllocation {
  lotId: string | null;
  quantity: number;
}

export class InsufficientStockError extends Error {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Estoque insuficiente: pedido ${requested}, disponível ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export class ExpiredLotError extends Error {
  constructor(readonly lotId: string) {
    super('Lote vencido não pode ser vendido');
    this.name = 'ExpiredLotError';
  }
}

export interface AllocateOptions {
  /** Data usada como "hoje"; injetada para o teste não depender do relógio. */
  now?: Date;
  /** Lotes sem validade entram por último — presumem-se os mais antigos em cadastro. */
  allowUndated?: boolean;
}

export function allocateFefo(
  balances: readonly LotBalance[],
  requested: number,
  options: AllocateOptions = {},
): LotAllocation[] {
  if (requested <= 0) throw new RangeError('Quantidade a baixar deve ser positiva');

  const now = options.now ?? new Date();
  const allowUndated = options.allowUndated ?? true;

  const usable = balances
    .filter((balance) => balance.quantity > 0)
    .filter((balance) => (balance.expiresAt ? balance.expiresAt >= startOfDay(now) : allowUndated))
    .sort(byExpirationThenLot);

  const available = usable.reduce((total, balance) => total + balance.quantity, 0);
  if (available < requested) throw new InsufficientStockError(requested, available);

  const allocations: LotAllocation[] = [];
  let remaining = requested;

  for (const balance of usable) {
    if (remaining <= 0) break;
    const taken = Math.min(balance.quantity, remaining);
    allocations.push({ lotId: balance.lotId, quantity: round4(taken) });
    remaining = round4(remaining - taken);
  }

  return allocations;
}

/** Lote a vencer em poucos dias: o operador precisa ser avisado, sem travar a venda. */
export function lotsExpiringWithin(
  balances: readonly LotBalance[],
  days: number,
  now = new Date(),
): LotBalance[] {
  const limit = new Date(startOfDay(now).getTime() + days * 86_400_000);
  return balances.filter(
    (balance) => balance.quantity > 0 && balance.expiresAt && balance.expiresAt <= limit,
  );
}

function byExpirationThenLot(a: LotBalance, b: LotBalance): number {
  if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
  if (a.expiresAt) return -1;
  if (b.expiresAt) return 1;
  return (a.lotId ?? '').localeCompare(b.lotId ?? '');
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
