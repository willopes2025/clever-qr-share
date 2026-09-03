/**
 * Reimpressão de cupom e vendas recusadas, no PDV.
 *
 * As duas coisas que o balcão precisa e não tinha. Impressora trava e cliente
 * pede segunda via — e como a impressora é local, isso tem que funcionar mesmo
 * sem rede, por isso o cupom fica guardado no próprio terminal. E a venda que
 * o servidor recusou aparecia em vermelho sem nada para fazer a respeito.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN ?? 'soul-pdv-q01-6a2634b4';
const SHOT = process.env.SHOT_DIR ?? '/tmp';

const fails = [];
const ok = (n, c, e = '') => { console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${e ? ' — ' + e : ''}`); if (!c) fails.push(n); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage();

await p.goto(`${BASE}/pdv/`, { waitUntil: 'networkidle' });
await p.fill('#deviceToken', DEVICE_TOKEN);
await p.click('button:has-text("Ativar terminal")');
await p.waitForTimeout(3000);
await p.locator('button, [role=button]').filter({ hasText: 'Camila Souza' }).first().click();
await p.waitForTimeout(3000);

ok('botão de últimas vendas existe', await p.locator('text=Últimas vendas').first().isVisible());

// Vende um item para ter cupom guardado.
const busca = p.locator('input').first();
await busca.fill('pote');
await p.waitForTimeout(1200);
const primeiro = p.locator('button').filter({ hasText: /Pote/ }).first();
if (await primeiro.isVisible().catch(() => false)) {
  await primeiro.click();
  await p.waitForTimeout(800);
  await p.keyboard.press('F2');
  await p.waitForTimeout(1200);
  const dinheiro = p.locator('button').filter({ hasText: /Dinheiro/i }).first();
  if (await dinheiro.isVisible().catch(() => false)) await dinheiro.click();
  await p.waitForTimeout(400);
  // Campo vazio usa o valor restante como padrão: "Lançar" fecha a conta.
  await p.getByRole('button', { name: 'Lançar' }).click();
  await p.waitForTimeout(600);
  const confirmar = p.getByRole('button', { name: /Concluir venda/ });
  await confirmar.click();
  await p.waitForTimeout(4000);
}

// F10 abre o histórico.
await p.keyboard.press('F10');
await p.waitForTimeout(1500);
const dialogo = await p.locator('body').innerText();
ok('F10 abre as últimas vendas', /Últimas vendas/.test(dialogo));
ok('lista os cupons do terminal', /Cupons deste terminal/i.test(dialogo));
await p.screenshot({ path: `${SHOT}/pdv-historico.png`, fullPage: true });

const reimprimir = p.getByRole('button', { name: 'Reimprimir', exact: true }).first();
const temCupom = await reimprimir.isVisible().catch(() => false);
ok('cupom fica guardado para reimpressão', temCupom, temCupom ? '' : 'nenhuma venda registrada');

if (temCupom) {
  await reimprimir.click();
  await p.waitForTimeout(2500);
  const depois = await p.locator('body').innerText();
  // Sem SM Bridge rodando, a impressão falha — e a mensagem tem que dizer isso
  // em vez de sumir em silêncio.
  ok('reimpressão dá retorno ao operador', /Cupom reenviado|Não foi possível imprimir/.test(depois),
     /Cupom reenviado/.test(depois) ? 'imprimiu' : 'avisou que a impressora não respondeu');
}

await p.keyboard.press('Escape');
await p.waitForTimeout(600);
ok('ESC volta para a venda', !/Cupons deste terminal/.test(await p.locator('body').innerText()));

await b.close();
console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
