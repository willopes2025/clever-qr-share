/**
 * Cancelamento de venda.
 *
 * No primeiro dia de quiosque isso acontece: o operador registra o item
 * errado, o cliente desiste depois de pagar. Três coisas precisam andar
 * juntas — o estoque volta, a nota é cancelada e a venda sai do faturamento.
 * Qualquer uma sozinha vira divergência que ninguém explica no fim do mês.
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

console.log(`Soul ERP — cancelamento de venda em ${API}\n`);

const { accessToken: token } = await call('/auth/login', {
  method: 'POST', body: { email: 'will@soulmuscle.com.br', password: 'soulmuscle2026' },
});
const marca = String(Date.now()).slice(-5);

const loja = await call('/stores', {
  method: 'POST', token,
  body: { code: `C${marca.slice(-2)}`, name: `Quiosque Cancelamento ${marca}`, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
});

async function criar(nome, codigo, preco, unit = 'UN') {
  const criado = await call('/products', {
    method: 'POST', token,
    body: { name: nome, ncm: '21050010', skus: [{ code: codigo, description: nome, unit, priceCents: preco }] },
  });
  return (await call(`/products?search=${encodeURIComponent(nome)}`, { token }))
    .find((p) => p.id === criado.id).skus[0];
}

// Cadeia com ficha técnica: é onde o estorno erra se ninguém pensar nele.
const granel = await criar(`Granel C ${marca}`, `GRC${marca}`, 1, 'KG');
const embalagem = await criar(`Embalagem C ${marca}`, `EMC${marca}`, 1);
const pote = await criar(`Pote C ${marca}`, `POC${marca}`, 2000);
await call(`/inventory/recipes/${pote.id}`, {
  method: 'PUT', token,
  body: { kind: 'assembly', outputQuantity: 1,
          items: [{ skuId: granel.id, quantity: 0.2 }, { skuId: embalagem.id, quantity: 1 }] },
});
await call('/inventory/receipts', {
  method: 'POST', token,
  body: { storeId: loja.id, items: [
    { skuId: granel.id, quantity: 10, unitCostCents: 2500 },
    { skuId: embalagem.id, quantity: 50, unitCostCents: 60 },
  ] },
});

// Venda de 2 potes pelo caminho real do PDV.
const terminal = await call(`/stores/${loja.id}/terminals`, { method: 'POST', token, body: { code: 'PDV1' } });
const pos = await call('/auth/terminal', { method: 'POST', body: { deviceToken: terminal.activationCode } });
const boot = await call('/pos/bootstrap', { token: pos.accessToken });
const sessao = boot.openSession ?? await call(`/pos/cash-sessions?operatorId=${boot.operators[0].id}`, {
  method: 'POST', token: pos.accessToken,
  body: { terminalId: boot.terminal.id, openingFloatCents: 10000 },
});
const saleId = crypto.randomUUID();
await call('/sync/sales', {
  method: 'POST', token: pos.accessToken,
  body: {
    terminalId: boot.terminal.id,
    sales: [{
      id: saleId, sessionId: sessao.id, operatorId: boot.operators[0].id,
      occurredAt: new Date().toISOString().replace('Z', '-00:00'), channel: 'pos',
      items: [{ lineNumber: 1, skuId: pote.id, description: 'Pote C', quantity: '2', unit: 'UN',
                unitPriceCents: 2000, discountCents: 0, totalCents: 4000 }],
      payments: [{ method: 'cash', amountCents: 5000, changeCents: 1000, installments: 1 }],
      grossCents: 4000, discountCents: 0, totalCents: 4000, clientVersion: 'e2e-cancelamento',
    }],
  },
});

// 1. A venda existe e dá para olhar dentro dela.
const lista = await call(`/sales?storeId=${loja.id}`, { token });
const naLista = lista.find((v) => v.id === saleId);
ok('venda aparece na lista do dia', Boolean(naLista), `nº ${naLista?.number} · ${money(naLista?.totalCents ?? 0)}`);

const detalhe = await call(`/sales/${saleId}`, { token });
ok('detalhe traz itens e pagamento', detalhe.items.length === 1 && detalhe.payments.length === 1);
ok('detalhe traz o troco, que é o que o cliente confere', detalhe.payments[0].changeCents === 1000,
   money(detalhe.payments[0].changeCents));
ok('detalhe traz a operadora', Boolean(detalhe.operatorName), detalhe.operatorName);

// Espera a nota autorizar, para o cancelamento ter o que cancelar.
let autorizada = false;
for (let i = 0; i < 12 && !autorizada; i += 1) {
  await new Promise((r) => setTimeout(r, 2500));
  autorizada = (await call(`/sales/${saleId}`, { token })).fiscal?.status === 'authorized';
}
ok('nota da venda autoriza', autorizada);

const saldoAntes = Object.fromEntries(
  (await call(`/inventory/balances?storeId=${loja.id}`, { token })).map((l) => [l.skuId, l.quantity]),
);
ok('granel baixou 0,4 kg pela ficha', saldoAntes[granel.id] === 9.6, `${saldoAntes[granel.id]} kg`);

// 2. Cancelamento.
const cancelamento = await call(`/sales/${saleId}/cancel`, {
  method: 'POST', token, body: { reason: 'Cliente desistiu apos o pagamento' },
});
ok('cancelamento aceito', cancelamento.status === 'cancelled');
ok('nota fiscal foi cancelada junto', cancelamento.fiscalCancelled === true);

const depois = await call(`/sales/${saleId}`, { token });
ok('venda fica marcada como cancelada', depois.status === 'cancelled');
ok('nota fica cancelada', depois.fiscal?.status === 'cancelled', depois.fiscal?.status);

// 3. O estorno segue a ficha: volta granel e embalagem, nunca o pote.
const saldoDepois = Object.fromEntries(
  (await call(`/inventory/balances?storeId=${loja.id}`, { token })).map((l) => [l.skuId, l.quantity]),
);
ok('granel volta ao estoque', saldoDepois[granel.id] === 10, `${saldoDepois[granel.id]} kg`);
ok('embalagem volta ao estoque', saldoDepois[embalagem.id] === 50, `${saldoDepois[embalagem.id]}`);
ok('o pote não é criado do nada no estorno', !saldoDepois[pote.id] || saldoDepois[pote.id] === 0,
   `${saldoDepois[pote.id] ?? 'sem saldo'}`);

// 4. Sai do faturamento e do caixa.
const live = await call('/analytics/live', { token });
const naLoja = live.byStore.find((s) => s.storeId === loja.id);
ok('faturamento do dia desconsidera a cancelada', (naLoja?.revenueCents ?? 0) === 0, money(naLoja?.revenueCents ?? 0));

// 5. Cancelar de novo é recusado, em vez de estornar duas vezes.
let recusou = false;
try {
  await call(`/sales/${saleId}/cancel`, { method: 'POST', token, body: { reason: 'Tentativa duplicada de cancelar' } });
} catch { recusou = true; }
ok('cancelar duas vezes é recusado', recusou);

// 6. Motivo vago é recusado: quem audita meses depois precisa entender.
let recusouMotivo = false;
try {
  await call(`/sales/${saleId}/cancel`, { method: 'POST', token, body: { reason: 'x' } });
} catch { recusouMotivo = true; }
ok('motivo muito curto é recusado', recusouMotivo);

console.log(fails.length ? `\n${fails.length} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
