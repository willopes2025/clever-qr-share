import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EscPosBuilder } from './escpos';
import { renderCashReport, renderReceipt, type CashReportData, type ReceiptData } from './receipt';
import { probePrinter, sendToPrinter, PrinterError } from './printer';
import type { BridgeConfig } from './config';

export const VERSION = '1.0.0';
const MAX_BODY_BYTES = 256 * 1024;

interface RouteContext {
  config: BridgeConfig;
  body: unknown;
}

type Handler = (context: RouteContext) => Promise<unknown>;

/**
 * Servidor local do agente.
 *
 * Escuta só em 127.0.0.1: nada fora do computador do quiosque alcança a
 * impressora. O PDV é uma página na nuvem, então a origem dela é verificada
 * contra a lista do arquivo de configuração.
 */
export function createBridgeServer(config: BridgeConfig) {
  const routes: Record<string, Handler> = {
    'GET /health': async () => ({
      status: 'ok',
      version: VERSION,
      printerOk: await probePrinter(config.printer),
      transport: config.printer.transport,
    }),

    'GET /version': async () => ({ version: VERSION }),

    'POST /print/receipt': async ({ body }) => {
      const receipt = parseReceipt(body);
      await sendToPrinter(config.printer, buildReceiptPayload(receipt, config));
      return { printed: true };
    },

    'POST /print/test': async () => {
      await sendToPrinter(config.printer, buildTestPayload(config));
      return { printed: true };
    },

    'POST /print/cash-closing': async ({ body }) => {
      const report = parseCashReport(body);
      await sendToPrinter(config.printer, buildLinesPayload(renderCashReport(report, config.columns)));
      return { printed: true };
    },

    'POST /drawer/open': async () => {
      if (!config.drawer.enabled) return { opened: false, reason: 'gaveta desabilitada' };
      const payload = new EscPosBuilder().init().openDrawer(config.drawer.pin).build();
      await sendToPrinter(config.printer, payload);
      return { opened: true };
    },
  };

  return createServer((request, response) => {
    void handle(request, response, routes, config);
  });
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  routes: Record<string, Handler>,
  config: BridgeConfig,
): Promise<void> {
  const origin = request.headers.origin;
  applyCors(response, origin, config.allowedOrigins);

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  if (origin && !config.allowedOrigins.includes(origin)) {
    return send(response, 403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origem não autorizada' } });
  }

  const route = `${request.method} ${new URL(request.url ?? '/', 'http://localhost').pathname}`;
  const handler = routes[route];
  if (!handler) {
    return send(response, 404, { error: { code: 'NOT_FOUND', message: 'Rota inexistente' } });
  }

  try {
    const body = request.method === 'POST' ? await readJsonBody(request) : undefined;
    return send(response, 200, await handler({ config, body }));
  } catch (error) {
    if (error instanceof PrinterError) {
      // O PDV trata isso como aviso, não como erro que trava a venda.
      return send(response, 503, { error: { code: 'PRINTER_UNAVAILABLE', message: error.message } });
    }
    const message = error instanceof Error ? error.message : 'Falha inesperada';
    return send(response, 400, { error: { code: 'BAD_REQUEST', message } });
  }
}

function applyCors(response: ServerResponse, origin: string | undefined, allowed: string[]): void {
  if (origin && allowed.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
  }
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('vary', 'origin');
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }).end(body);
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Corpo da requisição grande demais'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    request.on('error', reject);
  });
}

export function buildReceiptPayload(receipt: ReceiptData, config: BridgeConfig): Buffer {
  return buildLinesPayload(renderReceipt(receipt, config.columns));
}

/**
 * Converte as linhas prontas em bytes. Linhas de destaque — o total do cupom, a
 * diferença do fechamento — saem em negrito: são o que se confere de relance.
 */
function buildLinesPayload(lines: string[]): Buffer {
  const builder = new EscPosBuilder().init().align('left');
  const highlighted = /^(TOTAL|DIFERENCA)/;

  for (const line of lines) {
    const emphasize = highlighted.test(line);
    if (emphasize) builder.bold(true);
    builder.line(line);
    if (emphasize) builder.bold(false);
  }

  return builder.cut().build();
}

/** Converte o corpo recebido no relatório de fechamento. */
export function parseCashReport(body: unknown): CashReportData {
  const report = body as Record<string, any>;
  if (!report || typeof report !== 'object') throw new Error('Relatório ausente no corpo da requisição');

  return {
    store: String(report.store ?? 'Soul Muscle'),
    terminal: String(report.terminal ?? ''),
    operator: String(report.operator ?? ''),
    openedAt: new Date(report.openedAt ?? Date.now()),
    closedAt: new Date(report.closedAt ?? Date.now()),
    openingFloatCents: Number(report.openingFloatCents ?? 0),
    salesCount: Number(report.salesCount ?? 0),
    movements: (report.movements ?? []).map((movement: Record<string, any>) => ({
      kind: String(movement.kind ?? ''),
      amountCents: Number(movement.amountCents ?? 0),
      reason: String(movement.reason ?? ''),
    })),
    expected: normalizeAmounts(report.expected),
    counted: normalizeAmounts(report.counted),
    differenceByMethod: normalizeAmounts(report.differenceByMethod),
    differenceCents: Number(report.differenceCents ?? 0),
    notes: report.notes ? String(report.notes) : undefined,
  };
}

function normalizeAmounts(source: unknown): Record<string, number> {
  if (!source || typeof source !== 'object') return {};
  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>).map(([key, value]) => [key, Number(value ?? 0)]),
  );
}

function buildTestPayload(config: BridgeConfig): Buffer {
  return new EscPosBuilder()
    .init()
    .align('center')
    .bold(true)
    .line('SOUL PDV')
    .bold(false)
    .line('Teste de impressao')
    .line(new Date().toLocaleString('pt-BR'))
    .line('Acentuacao: coracao, pao, acai')
    .line(`Colunas: ${config.columns}`)
    .cut()
    .build();
}

/** Converte o corpo recebido do PDV no cupom, recusando o que não dá para imprimir. */
export function parseReceipt(body: unknown): ReceiptData {
  const payload = (body as { sale?: unknown })?.sale ?? body;
  if (!payload || typeof payload !== 'object') throw new Error('Cupom ausente no corpo da requisição');

  const sale = payload as Record<string, any>;
  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    throw new Error('Cupom precisa de ao menos um item');
  }

  return {
    store: String(sale.store ?? 'Soul Muscle'),
    cnpj: String(sale.cnpj ?? ''),
    terminal: String(sale.terminal ?? ''),
    operator: String(sale.operator ?? ''),
    saleNumber: sale.number ? Number(sale.number) : undefined,
    occurredAt: sale.occurredAt ? new Date(sale.occurredAt) : new Date(),
    items: sale.items.map((item: Record<string, any>) => ({
      description: String(item.description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unitPriceCents: Number(item.unitPriceCents ?? 0),
      totalCents: Number(item.totalCents ?? 0),
    })),
    totalCents: Number(sale.totalCents ?? 0),
    discountCents: sale.discountCents ? Number(sale.discountCents) : undefined,
    payments: (sale.payments ?? []).map((payment: Record<string, any>) => ({
      method: String(payment.method ?? ''),
      amountCents: Number(payment.amountCents ?? 0),
      changeCents: payment.changeCents ? Number(payment.changeCents) : undefined,
      cardBrand: payment.cardBrand ? String(payment.cardBrand) : undefined,
    })),
    customerDocument: sale.customerDocument ? String(sale.customerDocument) : undefined,
    fiscal: sale.fiscal?.accessKey
      ? {
          accessKey: String(sale.fiscal.accessKey),
          number: Number(sale.fiscal.number ?? 0),
          series: Number(sale.fiscal.series ?? 0),
          qrCode: sale.fiscal.qrCode ? String(sale.fiscal.qrCode) : undefined,
        }
      : undefined,
  };
}
