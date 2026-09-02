/**
 * Prova que o painel reage à venda sem recarregar.
 *
 * Abre a retaguarda num navegador de verdade, anota o faturamento, registra
 * uma venda pela API como o PDV faria, e confere se o número mudou sozinho —
 * sem F5 e sem esperar o intervalo de segurança de um minuto.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const API = `${BASE}/v1`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN ?? 'soul-pdv-q01-6a2634b4';

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
  if (!response.ok) throw new Error(`${path} → ${response.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#password', 'soulmuscle2026');
await page.click('button:has-text("Entrar")');
await page.waitForTimeout(3000);

const aoVivo = await page.locator('text=ao vivo').first().isVisible().catch(() => false);
ok('painel diz que está ao vivo', aoVivo);

const faturamento = () =>
  page.locator('text=Faturamento hoje').locator('xpath=..').innerText();
const antes = await faturamento();
console.log(`     faturamento antes: ${antes.replace(/\n/g, ' ')}`);

// Venda pelo caminho real do PDV: autenticar terminal e sincronizar.
const terminalAuth = await call('/auth/terminal', { method: 'POST', body: { deviceToken: DEVICE_TOKEN } });
const posToken = terminalAuth.accessToken;
const bootstrap = await call('/pos/bootstrap', { token: posToken });
const item = bootstrap.catalog[0];
const operator = bootstrap.operators[0];

const session =
  bootstrap.openSession ??
  (await call(`/pos/cash-sessions?operatorId=${operator.id}`, {
    method: 'POST',
    token: posToken,
    body: { terminalId: bootstrap.terminal.id, openingFloatCents: 10000 },
  }));

const total = item.priceCents;
await call('/sync/sales', {
  method: 'POST',
  token: posToken,
  body: {
    terminalId: bootstrap.terminal.id,
    sales: [{
      id: crypto.randomUUID(),
      sessionId: session.id,
      operatorId: operator.id,
      occurredAt: new Date().toISOString().replace('Z', '-00:00'),
      channel: 'pos',
      items: [{
        lineNumber: 1, skuId: item.skuId, description: item.description,
        quantity: '1', unit: 'UN', unitPriceCents: item.priceCents,
        discountCents: 0, totalCents: total,
      }],
      payments: [{ method: 'cash', amountCents: total, changeCents: 0, installments: 1 }],
      grossCents: total, discountCents: 0, totalCents: total, clientVersion: 'e2e-tempo-real',
    }],
  },
});
console.log(`     venda registrada: R$ ${(total / 100).toFixed(2)}`);

// Sem recarregar: espera o número mudar sozinho, bem antes do poll de 60s.
const mudou = await page
  .waitForFunction(
    (anterior) => {
      const tile = [...document.querySelectorAll('*')].find(
        (el) => el.children.length === 0 && /Faturamento hoje/.test(el.textContent || ''),
      );
      return tile?.parentElement && tile.parentElement.innerText !== anterior;
    },
    antes,
    { timeout: 15000 },
  )
  .then(() => true)
  .catch(() => false);

const depois = await faturamento();
ok('faturamento muda sozinho, sem recarregar', mudou, `${antes.replace(/\n/g, ' ')} → ${depois.replace(/\n/g, ' ')}`);

const piscou = await page.locator('text=venda registrada agora').isVisible().catch(() => false);
ok('painel avisa que a venda acabou de entrar', piscou);

await page.screenshot({ path: '/tmp/claude-0/-home-user-clever-qr-share/8653b34f-12ce-5fea-9fa7-69cfae1f1b98/scratchpad/tempo-real.png', fullPage: true });
await browser.close();

console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
