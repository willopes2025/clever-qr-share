import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FocusNfeProvider } from './focus-nfe.provider';
import type { FiscalIssueInput } from '../fiscal-provider';

interface Received {
  method: string;
  url: string;
  authorization?: string;
  body: any;
}

/**
 * Dublê da Focus NFe. O objetivo aqui não é reproduzir a SEFAZ, é provar o que
 * só se vê no fio: o endereço chamado, o Basic auth com senha vazia, a
 * referência na query e o reencontro da nota quando o reenvio recebe 422.
 */
function fakeFocus(handler: (req: Received) => { status: number; body: unknown }) {
  const received: Received[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      const entry: Received = {
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      };
      received.push(entry);
      const { status, body } = handler(entry);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  return { server, received };
}

function saleInput(documentId: string): FiscalIssueInput {
  return {
    documentId,
    model: 65,
    series: 1,
    environment: 2,
    issuer: {
      cnpj: '12345678000190',
      legalName: 'Soul Muscle Alimentos LTDA',
      tradeName: 'Soul Muscle',
      ie: '110042490114',
      crt: 1,
      address: {},
    },
    customerDocument: null,
    items: [
      {
        lineNumber: 1,
        code: '10301',
        description: 'Pote 1L Chocolate Belga',
        ncm: '21050010',
        cfop: '5102',
        unit: 'UN',
        quantity: 2,
        unitPriceCents: 3490,
        totalCents: 6980,
        discountCents: 0,
      },
    ],
    payments: [{ method: 'credit', amountCents: 6980, cardBrand: 'visa' }],
    totalCents: 6980,
    discountCents: 0,
    occurredAt: new Date('2026-09-14T19:32:00-03:00'),
  };
}

describe('FocusNfeProvider', () => {
  let server: Server;
  let received: Received[];
  let respond: (req: Received) => { status: number; body: unknown };

  beforeAll(async () => {
    const fake = fakeFocus((req) => respond(req));
    server = fake.server;
    received = fake.received;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    process.env.FOCUS_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.FOCUS_TOKEN = 'token-de-teste';
  });

  afterAll(async () => {
    delete process.env.FOCUS_BASE_URL;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('emite com o documento como referência e autentica com token na senha vazia', async () => {
    received.length = 0;
    respond = () => ({ status: 200, body: { status: 'processando_autorizacao' } });

    const result = await new FocusNfeProvider().issue(saleInput('doc-1'));

    expect(result.status).toBe('processing');
    expect(received[0].method).toBe('POST');
    expect(received[0].url).toBe('/v2/nfce?ref=doc-1');
    expect(received[0].authorization).toBe(
      `Basic ${Buffer.from('token-de-teste:').toString('base64')}`,
    );
    expect(received[0].body.cnpj_emitente).toBe('12345678000190');
  });

  it('reenvio de nota já autorizada consulta em vez de rejeitar', async () => {
    received.length = 0;
    respond = (req) =>
      req.method === 'POST'
        ? { status: 422, body: { codigo: 'nfe_autorizada', mensagem: 'NFe já autorizada' } }
        : {
            status: 200,
            body: { status: 'autorizado', numero: '42', chave_nfe: `NFe${'9'.repeat(44)}` },
          };

    const result = await new FocusNfeProvider().issue(saleInput('doc-2'));

    expect(result.status).toBe('authorized');
    expect(result.accessKey).toBe('9'.repeat(44));
    expect(received.map((r) => r.method)).toEqual(['POST', 'GET']);
    expect(received[1].url).toBe('/v2/nfce/doc-2');
  });

  it('indisponibilidade da Focus volta para a fila, não vira rejeição definitiva', async () => {
    received.length = 0;
    respond = () => ({ status: 502, body: { mensagem: 'bad gateway' } });

    const result = await new FocusNfeProvider().issue(saleInput('doc-3'));

    expect(result.status).toBe('rejected');
    expect(result.rejection?.retryable).toBe(true);
    expect(result.rejection?.code).toBe('HTTP_502');
  });

  it('cancelamento exige justificativa e envia DELETE com ela', async () => {
    received.length = 0;
    respond = () => ({ status: 200, body: { status: 'cancelado', protocolo: '135260000999' } });
    const provider = new FocusNfeProvider();

    expect((await provider.cancel('doc-4', 'curta')).status).toBe('rejected');
    expect(received).toHaveLength(0);

    const ok = await provider.cancel('doc-4', 'Cliente desistiu da compra no caixa');
    expect(ok.status).toBe('accepted');
    expect(ok.protocol).toBe('135260000999');
    expect(received[0].method).toBe('DELETE');
    expect(received[0].body.justificativa).toBe('Cliente desistiu da compra no caixa');
  });

  it('queda de rede não derruba a venda: vira rejeição reenviável', async () => {
    const original = process.env.FOCUS_BASE_URL;
    process.env.FOCUS_BASE_URL = 'http://127.0.0.1:1'; // porta fechada
    try {
      const result = await new FocusNfeProvider().issue(saleInput('doc-5'));
      expect(result.status).toBe('rejected');
      expect(result.rejection?.retryable).toBe(true);
    } finally {
      process.env.FOCUS_BASE_URL = original;
    }
  });
});
