/**
 * Teste de fumaça do Soul ERP: percorre o caminho crítico de ponta a ponta —
 * login, abertura de caixa, venda de potes, sincronização idempotente,
 * emissão fiscal e painel de performance.
 *
 * Uso: node scripts/smoke.mjs [http://localhost:3000/v1]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000/v1';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

let failures = 0;

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

function check(label, condition, detail = '') {
  const mark = condition ? '  ok  ' : ' FALHA';
  if (!condition) failures += 1;
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
}

const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`\nSoul ERP — teste de fumaça em ${BASE}\n`);

  const health = await call('/health');
  check('API respondendo', health.status === 'ok');

  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: 'will@soulmuscle.com.br', password: 'soulmuscle2026' },
  });
  check('login da retaguarda', Boolean(login.accessToken), login.user.name);

  if (!DEVICE_TOKEN) {
    console.log('\nDefina DEVICE_TOKEN com o token do terminal (saída do seed) para testar o PDV.\n');
    process.exit(failures > 0 ? 1 : 0);
  }

  const terminalAuth = await call('/auth/terminal', {
    method: 'POST',
    body: { deviceToken: DEVICE_TOKEN },
  });
  const posToken = terminalAuth.accessToken;
  check('terminal pareado', Boolean(posToken), terminalAuth.terminal.storeName);

  const bootstrap = await call('/pos/bootstrap', { token: posToken });
  check('catálogo baixado para o PDV', bootstrap.catalog.length > 0, `${bootstrap.catalog.length} itens`);

  const pote = bootstrap.catalog.find((item) => item.description.startsWith('Pote'));
  const avulso = bootstrap.catalog.find((item) => !item.description.startsWith('Pote'));
  check('pote de sorvete no catálogo', Boolean(pote), pote?.description);

  const operator = bootstrap.operators[0];
  const session =
    bootstrap.openSession ??
    (await call(`/pos/cash-sessions?operatorId=${operator.id}`, {
      method: 'POST',
      token: posToken,
      body: { terminalId: bootstrap.terminal.id, openingFloatCents: 10000 },
    }));
  check('caixa aberto', Boolean(session.id));

  // Venda: 2 potes + 1 complemento — o carrinho típico do quiosque.
  const quantidade = 2;
  const totalPotes = pote.priceCents * quantidade;
  const total = totalPotes + avulso.priceCents;
  const saleId = crypto.randomUUID();

  const salePayload = {
    terminalId: bootstrap.terminal.id,
    sales: [
      {
        id: saleId,
        sessionId: session.id,
        operatorId: operator.id,
        occurredAt: new Date().toISOString().replace('Z', '-00:00'),
        channel: 'pos',
        items: [
          {
            lineNumber: 1,
            skuId: pote.skuId,
            description: pote.description,
            quantity: String(quantidade),
            unit: 'UN',
            unitPriceCents: pote.priceCents,
            discountCents: 0,
            totalCents: totalPotes,
          },
          {
            lineNumber: 2,
            skuId: avulso.skuId,
            description: avulso.description,
            quantity: '1',
            unit: 'UN',
            unitPriceCents: avulso.priceCents,
            discountCents: 0,
            totalCents: avulso.priceCents,
          },
        ],
        payments: [
          { method: 'debit', amountCents: total, changeCents: 0, cardBrand: 'visa', installments: 1 },
        ],
        grossCents: total,
        discountCents: 0,
        totalCents: total,
        clientVersion: 'smoke-1.0',
      },
    ],
  };

  const first = await call('/sync/sales', { method: 'POST', token: posToken, body: salePayload });
  check('venda sincronizada', first.results[0]?.status === 'accepted', `nº ${first.results[0]?.number} · ${money(total)}`);
  check('nota entrou na fila fiscal', first.results[0]?.fiscal.status === 'queued');

  // Reenvio do mesmo lote: o PDV faz isso sempre que a rede oscila.
  const retry = await call('/sync/sales', { method: 'POST', token: posToken, body: salePayload });
  check('reenvio não duplica a venda', retry.results[0]?.status === 'duplicate');
  check('número da venda preservado no reenvio', retry.results[0]?.number === first.results[0]?.number);

  await call('/telemetry/heartbeat', {
    method: 'POST',
    token: posToken,
    body: {
      terminalId: bootstrap.terminal.id,
      appVersion: '1.0.0',
      pendingSales: 0,
      printerOk: true,
      scaleOk: true,
      lastSaleAt: new Date().toISOString().replace('Z', '-00:00'),
    },
  });
  check('heartbeat do terminal registrado', true);

  console.log('\n  aguardando a fila fiscal processar...');
  let fiscal = null;
  for (let attempt = 0; attempt < 8 && !fiscal; attempt += 1) {
    await sleep(2500);
    const documents = await call('/fiscal/documents', { token: login.accessToken });
    fiscal = documents.find((document) => document.id === first.results[0].fiscal.documentId);
    if (fiscal?.status === 'queued' || fiscal?.status === 'sending') fiscal = null;
  }
  check('NFC-e autorizada pelo gateway', fiscal?.status === 'authorized', fiscal?.accessKey ?? fiscal?.status);

  const live = await call('/analytics/live', { token: login.accessToken });
  check('painel de performance responde', live.byStore.length > 0,
    `${money(live.revenueCents)} · ${live.salesCount} vendas · ticket ${money(live.avgTicketCents)}`);

  const health2 = await call('/telemetry/terminals', { token: login.accessToken });
  check('monitor de terminais responde', health2.length > 0, `${health2.filter((t) => t.online).length} online`);

  const mix = await call('/analytics/mix', { token: login.accessToken });
  check('mix de produtos calculado', mix.length > 0, mix[0]?.description);

  console.log(failures === 0 ? '\nTudo certo.\n' : `\n${failures} verificação(ões) falharam.\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nErro no teste de fumaça:', error.message, '\n');
  process.exit(1);
});
