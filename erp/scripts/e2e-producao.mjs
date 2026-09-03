/**
 * Calda → sorvete → potes.
 *
 * O quiosque compra calda em litro, a máquina transforma em sorvete pesado em
 * quilo (incorporando ar), e o sorvete é vendido em potes de tamanhos
 * diferentes. Nada disso é conversão de unidade: é rendimento de processo, que
 * varia, e composição, que é cadastro.
 *
 * Este roteiro exercita a cadeia inteira e cobra o que ela precisa provar: que
 * o pote não é estocado, que o granel desce sozinho ao vender, que o rendimento
 * medido aparece, e que o custo caminha da calda até o pote.
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

console.log(`Soul ERP — produção e ficha técnica em ${API}\n`);

const { accessToken: token } = await call('/auth/login', {
  method: 'POST', body: { email: 'will@soulmuscle.com.br', password: 'soulmuscle2026' },
});
const marca = String(Date.now()).slice(-5);

const loja = await call('/stores', {
  method: 'POST', token,
  body: { code: `P${marca.slice(-2)}`, name: `Quiosque Producao ${marca}`, kind: 'kiosk', opensAt: '10:00', closesAt: '22:00' },
});

/** Cria produto e devolve o SKU. */
async function criar(nome, codigo, precoCents, unit = 'UN') {
  const criado = await call('/products', {
    method: 'POST', token,
    body: { name: nome, ncm: '21050010', skus: [{ code: codigo, description: nome, unit, priceCents: precoCents }] },
  });
  const lista = await call(`/products?search=${encodeURIComponent(nome)}`, { token });
  return lista.find((p) => p.id === criado.id).skus[0];
}

const calda = await criar(`Calda Chocolate ${marca}`, `CAL${marca}`, 1, 'L');
const granel = await criar(`Sorvete Granel ${marca}`, `GRA${marca}`, 1, 'KG');
const embalagemP = await criar(`Embalagem P ${marca}`, `EMP${marca}`, 1);
const embalagemG = await criar(`Embalagem G ${marca}`, `EMG${marca}`, 1);
const poteP = await criar(`Pote P ${marca}`, `POP${marca}`, 1500);
const poteG = await criar(`Pote G ${marca}`, `POG${marca}`, 2800);
ok('cadastro do encadeamento criado', Boolean(calda.id && granel.id && poteP.id));

// Ficha de produção: 6 L de calda rendem 7,2 kg de sorvete (ar incorporado).
await call(`/inventory/recipes/${granel.id}`, {
  method: 'PUT', token,
  body: { kind: 'production', outputQuantity: 7.2, notes: '6 L de calda com ar incorporado',
          items: [{ skuId: calda.id, quantity: 6 }] },
});

// Fichas de montagem: cada pote tira do granel e da própria embalagem.
await call(`/inventory/recipes/${poteP.id}`, {
  method: 'PUT', token,
  body: { kind: 'assembly', outputQuantity: 1,
          items: [{ skuId: granel.id, quantity: 0.12 }, { skuId: embalagemP.id, quantity: 1 }] },
});
await call(`/inventory/recipes/${poteG.id}`, {
  method: 'PUT', token,
  body: { kind: 'assembly', outputQuantity: 1,
          items: [{ skuId: granel.id, quantity: 0.3 }, { skuId: embalagemG.id, quantity: 1 }] },
});
const fichaP = await call(`/inventory/recipes/${poteP.id}`, { token });
ok('ficha do pote grava os dois insumos', fichaP.items.length === 2);

// Entrada: 12 L de calda a R$ 30,00 e embalagens.
await call('/inventory/receipts', {
  method: 'POST', token,
  body: {
    storeId: loja.id,
    document: `NF-${marca}`,
    items: [
      { skuId: calda.id, quantity: 12, unitCostCents: 3000 },
      { skuId: embalagemP.id, quantity: 100, unitCostCents: 50 },
      { skuId: embalagemG.id, quantity: 100, unitCostCents: 80 },
    ],
  },
});

// Produção: usou 6 L e a máquina deu 6,84 kg — 5% abaixo do previsto.
const producao = await call('/inventory/productions', {
  method: 'POST', token,
  body: { storeId: loja.id, outputSkuId: granel.id, producedQuantity: 6.84, batches: 1, notes: 'Máquina 1' },
});
ok('produção usa a ficha para saber o previsto', producao.expectedQuantity === 7.2, `${producao.expectedQuantity} kg`);
ok('rendimento medido aparece', producao.yieldRatio === 0.95, `${(producao.yieldRatio * 100).toFixed(0)}%`);
ok('custo dos insumos vai inteiro para o produzido', producao.inputCostCents === 18000, money(producao.inputCostCents));
ok('custo do quilo já embute a perda', producao.unitCostCents === 2632, `${money(producao.unitCostCents)}/kg`);

const saldos = async () => {
  const linhas = await call(`/inventory/balances?storeId=${loja.id}`, { token });
  return Object.fromEntries(linhas.map((l) => [l.skuId, l]));
};
let s = await saldos();
ok('calda baixou os 6 litros usados', s[calda.id].quantity === 6, `${s[calda.id].quantity} L`);
ok('sorvete a granel entrou no estoque', s[granel.id].quantity === 6.84, `${s[granel.id].quantity} kg`);

// Venda: 2 potes P e 1 pote G, pelo caminho real do PDV.
const terminal = await call(`/stores/${loja.id}/terminals`, { method: 'POST', token, body: { code: 'PDV1' } });
const pos = await call('/auth/terminal', { method: 'POST', body: { deviceToken: terminal.activationCode } });
const boot = await call('/pos/bootstrap', { token: pos.accessToken });
const sessao = boot.openSession ?? await call(`/pos/cash-sessions?operatorId=${boot.operators[0].id}`, {
  method: 'POST', token: pos.accessToken,
  body: { terminalId: boot.terminal.id, openingFloatCents: 10000 },
});

const venda = await call('/sync/sales', {
  method: 'POST', token: pos.accessToken,
  body: {
    terminalId: boot.terminal.id,
    sales: [{
      id: crypto.randomUUID(), sessionId: sessao.id, operatorId: boot.operators[0].id,
      occurredAt: new Date().toISOString().replace('Z', '-00:00'), channel: 'pos',
      items: [
        { lineNumber: 1, skuId: poteP.id, description: 'Pote P', quantity: '2', unit: 'UN',
          unitPriceCents: 1500, discountCents: 0, totalCents: 3000 },
        { lineNumber: 2, skuId: poteG.id, description: 'Pote G', quantity: '1', unit: 'UN',
          unitPriceCents: 2800, discountCents: 0, totalCents: 2800 },
      ],
      payments: [{ method: 'cash', amountCents: 5800, changeCents: 0, installments: 1 }],
      grossCents: 5800, discountCents: 0, totalCents: 5800, clientVersion: 'e2e-producao',
    }],
  },
});
ok('venda dos potes é aceita', venda.results[0]?.status === 'accepted');

s = await saldos();
// 2 × 0,12 + 1 × 0,30 = 0,54 kg saíram do tanque.
ok('granel desce pelo que foi vendido', s[granel.id].quantity === 6.3, `${s[granel.id].quantity} kg`);
ok('embalagem P desce 2', s[embalagemP.id].quantity === 98, `${s[embalagemP.id].quantity}`);
ok('embalagem G desce 1', s[embalagemG.id].quantity === 99, `${s[embalagemG.id].quantity}`);
ok('o pote em si não é estocado', !s[poteP.id] || s[poteP.id].quantity === 0, `${s[poteP.id]?.quantity ?? 'sem saldo'}`);
ok('calda não é tocada pela venda', s[calda.id].quantity === 6, `${s[calda.id].quantity} L`);

// Histórico de produção guarda o rendimento para comparar entre dias.
const historico = await call(`/inventory/productions?storeId=${loja.id}`, { token });
ok('histórico de produção registra o rendimento', historico[0]?.yieldRatio === 0.95,
   `${historico[0]?.producedQuantity}/${historico[0]?.expectedQuantity} ${historico[0]?.outputUnit}`);

// Produção sem ficha exige que alguém diga o que foi consumido.
let recusou = false;
try {
  await call('/inventory/productions', {
    method: 'POST', token,
    body: { storeId: loja.id, outputSkuId: embalagemP.id, producedQuantity: 5 },
  });
} catch { recusou = true; }
ok('produção sem ficha e sem insumo é recusada', recusou);

console.log(fails.length ? `\n${fails.length} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
