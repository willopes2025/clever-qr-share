/**
 * Layout do cupom.
 *
 * Impressora térmica escreve em colunas de largura fixa, então o cupom é
 * montado como texto puro e só depois vira bytes. Manter isso separado do
 * ESC/POS deixa o formato testável linha a linha — e é o formato que o cliente
 * leva para casa.
 */
export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface ReceiptPayment {
  method: string;
  amountCents: number;
  changeCents?: number;
  cardBrand?: string;
}

export interface ReceiptData {
  store: string;
  cnpj: string;
  terminal: string;
  operator: string;
  saleNumber?: number;
  occurredAt: Date;
  items: ReceiptItem[];
  totalCents: number;
  discountCents?: number;
  payments: ReceiptPayment[];
  customerDocument?: string;
  /** Preenchido quando a NFC-e já foi autorizada; ausente enquanto está na fila. */
  fiscal?: { accessKey: string; number: number; series: number; qrCode?: string };
}

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Cartao debito',
  credit: 'Cartao credito',
  pix: 'Pix',
  voucher: 'Voucher',
  store_credit: 'Credito do cliente',
};

export function renderReceipt(data: ReceiptData, columns = 48): string[] {
  const lines: string[] = [];
  const rule = '-'.repeat(columns);

  lines.push(center(data.store, columns));
  lines.push(center(`CNPJ ${formatCnpj(data.cnpj)}`, columns));
  lines.push(rule);

  for (const item of data.items) {
    // Descrição na primeira linha; quantidade e valores na segunda, alinhados à direita.
    lines.push(truncate(item.description, columns));
    lines.push(
      spread(
        `  ${formatQuantity(item.quantity)} x ${money(item.unitPriceCents)}`,
        money(item.totalCents),
        columns,
      ),
    );
  }

  lines.push(rule);
  if (data.discountCents) {
    lines.push(spread('Desconto', `-${money(data.discountCents)}`, columns));
  }
  lines.push(spread('TOTAL', money(data.totalCents), columns));

  for (const payment of data.payments) {
    const label = METHOD_LABELS[payment.method] ?? payment.method;
    const suffix = payment.cardBrand ? ` (${payment.cardBrand})` : '';
    lines.push(spread(`${label}${suffix}`, money(payment.amountCents), columns));
  }

  const change = data.payments.reduce((total, payment) => total + (payment.changeCents ?? 0), 0);
  if (change > 0) lines.push(spread('Troco', money(change), columns));

  lines.push(rule);
  if (data.customerDocument) lines.push(`CPF: ${formatCpf(data.customerDocument)}`);
  lines.push(spread(formatDateTime(data.occurredAt), `${data.terminal} · ${data.operator}`, columns));

  if (data.fiscal) {
    lines.push('');
    lines.push(center(`NFC-e ${data.fiscal.number} · serie ${data.fiscal.series}`, columns));
    lines.push(center('Chave de acesso', columns));
    // A chave sai em grupos de quatro: é assim que alguém consegue conferir ou digitar.
    for (const group of groupAccessKey(data.fiscal.accessKey, columns)) {
      lines.push(center(group, columns));
    }
    return lines;
  }

  lines.push('');
  lines.push(center('*** COMPROVANTE DE VENDA ***', columns));
  lines.push(center('Documento nao fiscal', columns));
  lines.push(center('A nota sera emitida quando', columns));
  lines.push(center('a conexao for restabelecida', columns));
  return lines;
}

/** Quebra a chave de 44 dígitos em grupos de quatro, no que couber na largura. */
export function groupAccessKey(accessKey: string, columns: number): string[] {
  const groups = accessKey.match(/.{1,4}/g) ?? [];
  const perLine = Math.max(Math.floor((columns + 1) / 5), 1);
  const lines: string[] = [];
  for (let i = 0; i < groups.length; i += perLine) {
    lines.push(groups.slice(i, i + perLine).join(' '));
  }
  return lines;
}

export function money(cents: number): string {
  const value = (Math.abs(cents) / 100).toFixed(2).replace('.', ',');
  const withThousands = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}${withThousands}`;
}

export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace('.', ',');
}

/** Alinha rótulo à esquerda e valor à direita, preenchendo o meio com espaços. */
export function spread(left: string, right: string, columns: number): string {
  const available = columns - right.length;
  const label = truncate(left, Math.max(available - 1, 1));
  return label.padEnd(available, ' ') + right;
}

export function center(value: string, columns: number): string {
  const text = truncate(value, columns);
  const padding = Math.max(Math.floor((columns - text.length) / 2), 0);
  return ' '.repeat(padding) + text;
}

export function truncate(value: string, columns: number): string {
  return value.length <= columns ? value : `${value.slice(0, columns - 1)}…`;
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Relatório de fechamento de caixa, impresso para o operador assinar e guardar. */
export interface CashReportData {
  store: string;
  terminal: string;
  operator: string;
  openedAt: Date;
  closedAt: Date;
  openingFloatCents: number;
  salesCount: number;
  movements: Array<{ kind: string; amountCents: number; reason: string }>;
  expected: Record<string, number>;
  counted: Record<string, number>;
  differenceByMethod: Record<string, number>;
  differenceCents: number;
  notes?: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  withdrawal: 'Sangria',
  supply: 'Suprimento',
  reinforcement: 'Reforco',
};

export function renderCashReport(data: CashReportData, columns = 48): string[] {
  const lines: string[] = [];
  const rule = '-'.repeat(columns);

  lines.push(center(data.store, columns));
  lines.push(center('FECHAMENTO DE CAIXA', columns));
  lines.push(rule);
  lines.push(spread('Terminal', data.terminal, columns));
  lines.push(spread('Operador', data.operator, columns));
  lines.push(spread('Abertura', formatMoment(data.openedAt), columns));
  lines.push(spread('Fechamento', formatMoment(data.closedAt), columns));
  lines.push(spread('Vendas no turno', String(data.salesCount), columns));
  lines.push(spread('Fundo de troco', money(data.openingFloatCents), columns));

  if (data.movements.length > 0) {
    lines.push(rule);
    for (const movement of data.movements) {
      const label = MOVEMENT_LABELS[movement.kind] ?? movement.kind;
      const signal = movement.kind === 'withdrawal' ? '-' : '+';
      lines.push(spread(`${label}: ${movement.reason}`, `${signal}${money(movement.amountCents)}`, columns));
    }
  }

  lines.push(rule);
  lines.push(padColumns('MEIO', 'ESPERADO', 'CONTADO', 'DIF.', columns));

  for (const method of methodOrder(data.expected, data.counted)) {
    lines.push(
      padColumns(
        METHOD_LABELS[method] ?? method,
        money(data.expected[method] ?? 0),
        money(data.counted[method] ?? 0),
        money(data.differenceByMethod[method] ?? 0),
        columns,
      ),
    );
  }

  lines.push(rule);
  lines.push(spread('DIFERENCA', money(data.differenceCents), columns));
  if (data.notes) {
    lines.push('');
    lines.push('Justificativa:');
    for (const line of wrap(data.notes, columns)) lines.push(line);
  }

  lines.push('');
  lines.push('');
  lines.push(center('_'.repeat(Math.min(30, columns)), columns));
  lines.push(center('Assinatura do operador', columns));
  return lines;
}

/** Quatro colunas: rótulo à esquerda e três valores alinhados à direita. */
function padColumns(label: string, a: string, b: string, c: string, columns: number): string {
  const valueWidth = 11;
  const labelWidth = Math.max(columns - valueWidth * 3, 6);
  return (
    truncate(label, labelWidth).padEnd(labelWidth) +
    a.padStart(valueWidth) +
    b.padStart(valueWidth) +
    c.padStart(valueWidth)
  ).slice(0, columns);
}

function methodOrder(expected: Record<string, number>, counted: Record<string, number>): string[] {
  const known = ['cash', 'debit', 'credit', 'pix', 'voucher', 'store_credit'];
  const present = new Set([...Object.keys(expected), ...Object.keys(counted)]);
  const ordered = known.filter((method) => present.has(method));
  const extras = [...present].filter((method) => !known.includes(method));
  return [...ordered, ...extras];
}

function wrap(text: string, columns: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + word).length + 1 > columns) {
      if (current) lines.push(current.trim());
      current = '';
    }
    current += `${word} `;
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function formatMoment(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
