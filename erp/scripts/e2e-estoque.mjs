/**
 * Estoque: entrada, saldo, contagem e extrato.
 *
 * Existia só a baixa pela venda — o saldo de qualquer loja virava ficção
 * depois da primeira venda, e uma loja nova nem vendia. Este roteiro exercita
 * a porta que faltava, incluindo o caso que mordeu em produção: saldo negativo
 * acertado por contagem.
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3000/v1';

const fails = [];
const ok = (n, c, e = '') => { console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${e ? ' — ' + e : ''}`); if (!c) fails.push(n); };
const money = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

async function call(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  const payload = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}

console.log(`Soul ERP — estoque em ${API}\n`);

const { accessToken: token } = await call('/auth/login', {
  method: 'POST', body: { email: 'will@soulmuscle.com.br', password: 'soulmuscle2026' },
});
const marca = String(Date.now()).slice(-5);

const loja = await call('/stores', {
  method: 'POST', token,
  body: { code: `E${marca.slice(-2)}`, name: `Quiosque Estoque ${marca}`, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
});

// Produto novo de propósito: o custo médio é do SKU e vale para todas as lojas,
// então um produto já usado no seed traria a média das outras lojas junto e o
// teste não conseguiria afirmar nada sobre a conta.
const produto = await call('/products', {
  method: 'POST', token,
  body: {
    name: `Pote Teste Estoque ${marca}`,
    ncm: '21050010',
    cest: '2300100',
    skus: [{ code: `TE${marca}`, description: `Pote Teste ${marca}`, priceCents: 2500 }],
  },
});
// A criação devolve só o id; o SKU vem da listagem.
const sku = (await call(`/products?search=${encodeURIComponent(`Pote Teste Estoque ${marca}`)}`, { token }))
  .find((linha) => linha.id === produto.id).skus[0];
ok('loja e produto de teste prontos', Boolean(loja.id && sku.id), sku.description);

// 1. Loja nova começa zerada.
let saldos = await call(`/inventory/balances?storeId=${loja.id}&search=${encodeURIComponent(sku.code)}`, { token });
const inicial = saldos.find((linha) => linha.skuId === sku.id);
ok('loja nova começa com saldo zero', inicial?.quantity === 0, `${inicial?.quantity}`);

// 2. Entrada de mercadoria com lote e validade.
await call('/inventory/receipts', {
  method: 'POST', token,
  body: {
    storeId: loja.id,
    document: `NF-${marca}`,
    items: [{ skuId: sku.id, quantity: 24, unitCostCents: 1200, lotCode: `L${marca}`, expiresAt: '2027-03-31' }],
  },
});
saldos = await call(`/inventory/balances?storeId=${loja.id}&search=${encodeURIComponent(sku.code)}`, { token });
const aposEntrada = saldos.find((linha) => linha.skuId === sku.id);
ok('entrada sobe o saldo', aposEntrada?.quantity === 24, `${aposEntrada?.quantity} un`);
ok('entrada grava o custo médio', aposEntrada?.avgCostCents === 1200, money(aposEntrada?.avgCostCents ?? 0));
ok('validade do lote fica visível', aposEntrada?.nextExpiry === '2027-03-31', String(aposEntrada?.nextExpiry));

// 3. Segunda entrada mais cara: a média pondera, não faz média simples.
await call('/inventory/receipts', {
  method: 'POST', token,
  body: { storeId: loja.id, items: [{ skuId: sku.id, quantity: 6, unitCostCents: 2000 }] },
});
saldos = await call(`/inventory/balances?storeId=${loja.id}&search=${encodeURIComponent(sku.code)}`, { token });
const aposSegunda = saldos.find((linha) => linha.skuId === sku.id);
ok('segunda entrada soma ao saldo', aposSegunda?.quantity === 30, `${aposSegunda?.quantity} un`);
ok('custo médio pondera pela quantidade', aposSegunda?.avgCostCents === 1360, money(aposSegunda?.avgCostCents ?? 0));

// 4. Contagem: sobrou menos na prateleira do que o sistema achava.
const contagem = await call('/inventory/counts', {
  method: 'POST', token,
  body: { storeId: loja.id, reason: 'Contagem semanal', items: [{ skuId: sku.id, countedQuantity: 27 }] },
});
ok('contagem acusa a diferença', contagem.differences[0]?.difference === -3,
   `esperado ${contagem.differences[0]?.expected}, contado ${contagem.differences[0]?.counted}`);

saldos = await call(`/inventory/balances?storeId=${loja.id}&search=${encodeURIComponent(sku.code)}`, { token });
ok('saldo passa a ser o contado', saldos.find((l) => l.skuId === sku.id)?.quantity === 27);

// 5. Contagem sem diferença não inventa movimento.
const semDiferenca = await call('/inventory/counts', {
  method: 'POST', token,
  body: { storeId: loja.id, reason: 'Reconferência', items: [{ skuId: sku.id, countedQuantity: 27 }] },
});
ok('contagem que bate não gera ajuste', semDiferenca.differences.length === 0);

// 6. Extrato conta a história inteira.
const extrato = await call(`/inventory/movements?storeId=${loja.id}&skuId=${sku.id}`, { token });
const tipos = extrato.map((m) => m.kind);
ok('extrato mostra entradas e ajuste', tipos.filter((k) => k === 'purchase').length === 2 && tipos.includes('adjust'),
   tipos.join(', '));

// 7. Saldo negativo — o caso que mordeu em produção — é acertável por contagem.
const outra = await call('/stores', {
  method: 'POST', token,
  body: { code: `X${marca.slice(-2)}`, name: `Quiosque Negativo ${marca}`, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
});
const pos = await call('/auth/terminal', {
  method: 'POST',
  body: { deviceToken: (await call(`/stores/${outra.id}/terminals`, { method: 'POST', token, body: { code: 'PDV1' } })).activationCode },
});
const boot = await call('/pos/bootstrap', { token: pos.accessToken });
const item = boot.catalog.find((c) => c.skuId === sku.id) ?? boot.catalog[0];
const sessao = boot.openSession ?? await call(`/pos/cash-sessions?operatorId=${boot.operators[0].id}`, {
  method: 'POST', token: pos.accessToken,
  body: { terminalId: boot.terminal.id, openingFloatCents: 10000 },
});
await call('/sync/sales', {
  method: 'POST', token: pos.accessToken,
  body: {
    terminalId: boot.terminal.id,
    sales: [{
      id: crypto.randomUUID(), sessionId: sessao.id, operatorId: boot.operators[0].id,
      occurredAt: new Date().toISOString().replace('Z', '-00:00'), channel: 'pos',
      items: [{ lineNumber: 1, skuId: item.skuId, description: item.description, quantity: '2',
                unit: 'UN', unitPriceCents: item.priceCents, discountCents: 0, totalCents: item.priceCents * 2 }],
      payments: [{ method: 'cash', amountCents: item.priceCents * 2, changeCents: 0, installments: 1 }],
      grossCents: item.priceCents * 2, discountCents: 0, totalCents: item.priceCents * 2, clientVersion: 'e2e-estoque',
    }],
  },
});
let negativos = await call(`/inventory/balances?storeId=${outra.id}`, { token });
ok('venda sem entrada deixa saldo negativo à vista', negativos[0]?.negative === true,
   `${negativos[0]?.description}: ${negativos[0]?.quantity}`);

await call('/inventory/counts', {
  method: 'POST', token,
  body: { storeId: outra.id, reason: 'Acerto inicial do quiosque', items: [{ skuId: item.skuId, countedQuantity: 40 }] },
});
negativos = await call(`/inventory/balances?storeId=${outra.id}`, { token });
ok('contagem conserta o negativo', negativos.every((l) => !l.negative));

console.log(fails.length ? `\n${fails.length} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
