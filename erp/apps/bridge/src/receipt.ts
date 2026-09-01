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

const METHOD_LABELS: Record<string, string> = {
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
