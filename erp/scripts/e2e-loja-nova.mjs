/**
 * Quiosque recém-aberto tem que vender no primeiro dia.
 *
 * Foi assim que a venda sumiu em produção: loja nova, sem estoque cadastrado,
 * a venda era recusada por "estoque insuficiente" e ia para quarentena no PDV.
 * Sem venda, sem nota, sem nada no painel — e ninguém via o motivo.
 *
 * Este roteiro reabre o caminho inteiro: cria loja, cria terminal, pareia,
 * abre caixa e vende sem nunca ter cadastrado entrada de estoque.
 */
const API = process.env.API_URL ?? 'http://127.0.0.1:3000/v1';

const fails = [];
const ok = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FALHA'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fails.push(name);
};

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} → ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}

console.log(`Soul ERP — quiosque novo vendendo do zero em ${API}\n`);

const { accessToken: admin } = await call('/auth/login', {
  method: 'POST',
  body: { email: 'will@soulmuscle.com.br', password: 'soulmuscle2026' },
});
const marca = String(Date.now()).slice(-5);

const loja = await call('/stores', {
  method: 'POST',
  token: admin,
  body: { code: `N${marca.slice(-2)}`, name: `Quiosque Novo ${marca}`, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
});
ok('loja criada pela retaguarda', Boolean(loja.id), loja.name);

const terminal = await call(`/stores/${loja.id}/terminals`, { method: 'POST', token: admin, body: { code: 'PDV1' } });
ok('terminal criado com série fiscal própria', Boolean(terminal.fiscalSeries), `série ${terminal.fiscalSeries}`);
ok('código de ativação entregue', Boolean(terminal.activationCode));

const pos = await call('/auth/terminal', { method: 'POST', body: { deviceToken: terminal.activationCode } });
ok('terminal pareia com o código', Boolean(pos.accessToken), pos.terminal.storeName);

const boot = await call('/pos/bootstrap', { token: pos.accessToken });
ok('catálogo chega no PDV', boot.catalog.length > 0, `${boot.catalog.length} itens`);

const operador = boot.operators[0];
const sessao =
  boot.openSession ??
  (await call(`/pos/cash-sessions?operatorId=${operador.id}`, {
    method: 'POST',
    token: pos.accessToken,
    body: { terminalId: boot.terminal.id, openingFloatCents: 10000 },
  }));
ok('caixa abre na loja nova', Boolean(sessao.id));

// Nenhuma entrada de estoque foi cadastrada nesta loja. A venda tem que passar.
const item = boot.catalog[0];
const total = item.priceCents;
const saleId = crypto.randomUUID();

const venda = await call('/sync/sales', {
  method: 'POST',
  token: pos.accessToken,
  body: {
    terminalId: boot.terminal.id,
    sales: [{
      id: saleId, sessionId: sessao.id, operatorId: operador.id,
      occurredAt: new Date().toISOString().replace('Z', '-00:00'), channel: 'pos',
      items: [{ lineNumber: 1, skuId: item.skuId, description: item.description, quantity: '1',
                unit: 'UN', unitPriceCents: item.priceCents, discountCents: 0, totalCents: total }],
      payments: [{ method: 'cash', amountCents: total, changeCents: 0, installments: 1 }],
      grossCents: total, discountCents: 0, totalCents: total, clientVersion: 'e2e-loja-nova',
    }],
  },
});

const resultado = venda.results[0];
ok('venda sem estoque cadastrado é aceita', resultado?.status === 'accepted',
   venda.rejected.length ? `recusada: ${venda.rejected[0].code}` : `nº ${resultado?.number}`);
ok('nota fiscal entra na fila', resultado?.fiscal?.status === 'queued', resultado?.fiscal?.documentId ?? '');

// A fila roda a cada 10s; espera o suficiente para o gateway responder.
console.log('\n  aguardando a fila fiscal...');
let documento = null;
for (let tentativa = 0; tentativa < 12; tentativa += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const documentos = await call('/fiscal/documents?status=authorized', { token: admin });
  documento = documentos.find((doc) => doc.id === resultado?.fiscal?.documentId);
  if (documento) break;
}
ok('nota é autorizada', Boolean(documento), documento?.accessKey ?? 'não autorizou a tempo');

console.log(fails.length ? `\n${fails.length} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
