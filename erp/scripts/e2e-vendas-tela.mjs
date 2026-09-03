/**
 * A tela de vendas, pelo navegador.
 *
 * Cobre o caminho que o dono vai fazer no primeiro dia: achar o cupom, abrir,
 * conferir, e cancelar com motivo. O cancelamento pede motivo de propósito —
 * quem auditar meses depois precisa entender o que aconteceu.
 */
import { chromium } from 'playwright';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = '/tmp/claude-0/-home-user-clever-qr-share/8653b34f-12ce-5fea-9fa7-69cfae1f1b98/scratchpad';
const fails = [];
const ok = (n, c, e = '') => { console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${e ? ' — ' + e : ''}`); if (!c) fails.push(n); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage();
await p.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await p.fill('#password', 'soulmuscle2026');
await p.click('button:has-text("Entrar")');
await p.waitForTimeout(2500);

const link = p.locator('a:has-text("Vendas")').first();
ok('menu tem Vendas', await link.isVisible());
await link.click();
await p.waitForTimeout(3000);

const body = await p.locator('body').innerText();
ok('lista do dia abre', /Cupom|Nenhuma venda/i.test(body));
await p.screenshot({ path: `${SHOT}/vendas-1-lista.png`, fullPage: true });

const linha = p.locator('tbody tr').first();
if (await linha.isVisible().catch(() => false)) {
  await linha.click();
  await p.waitForTimeout(2000);
  const detalhe = await p.locator('body').innerText();
  ok('detalhe do cupom abre', /Cupom #/.test(detalhe));
  ok('mostra total e pagamento', /Total/.test(detalhe));
  await p.screenshot({ path: `${SHOT}/vendas-2-detalhe.png`, fullPage: true });

  const botaoCancelar = p.locator('button:has-text("Cancelar venda")');
  if (await botaoCancelar.isVisible().catch(() => false)) {
    await botaoCancelar.click();
    await p.waitForTimeout(800);
    const form = await p.locator('body').innerText();
    ok('pede motivo antes de cancelar', /Motivo do cancelamento/i.test(form));
    ok('avisa da janela de 30 minutos da SEFAZ', /30 minutos/i.test(form));
    const confirmar = p.locator('button:has-text("Confirmar cancelamento")');
    ok('confirmar fica travado sem motivo', await confirmar.isDisabled());
    await p.locator('input[placeholder*="desistiu"]').fill('Teste de cancelamento pela tela');
    await p.waitForTimeout(300);
    ok('confirmar libera com motivo escrito', !(await confirmar.isDisabled()));
    await p.screenshot({ path: `${SHOT}/vendas-3-cancelar.png`, fullPage: true });
  } else {
    ok('venda do dia já cancelada — botão some corretamente', /cancelada/i.test(detalhe));
  }
} else {
  ok('sem venda hoje para abrir (lista vazia)', true);
}

await b.close();
console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
