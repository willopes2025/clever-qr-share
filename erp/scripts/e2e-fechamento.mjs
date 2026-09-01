/**
 * Percorre o fechamento de caixa no PDV: registra uma sangria, tenta fechar com
 * a contagem errada (que precisa exigir justificativa), corrige e confere o
 * relatório impresso pelo agente local.
 *
 * Requer API em :3000, PDV em :5173, SM Bridge em :9123 com transporte de
 * arquivo, e o banco semeado.
 * Uso: node scripts/e2e-fechamento.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const RECEIPT_FILE = '/tmp/cupom.bin';
const psql = (sql) =>
  execSync(
    `su postgres -c "/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -U soul -d soul_erp -t -A -c \\"${sql}\\""`,
  ).toString().trim();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const deviceToken = psql('select device_token from terminal order by fiscal_series limit 1');
if (existsSync(RECEIPT_FILE)) rmSync(RECEIPT_FILE);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.fill('#deviceToken', deviceToken);
await page.click('button:has-text("Ativar terminal")');
await page.waitForSelector('text=Quem está no caixa?', { timeout: 15000 });
await page.click('button:has-text("Camila")');
await page.waitForTimeout(800);
if (await page.locator('text=Abrir o caixa').count()) {
  await page.click('button:has-text("Abrir caixa")');
}
await page.waitForSelector('text=Total da venda', { timeout: 15000 });

// Uma venda em dinheiro, para o esperado do turno não ser zero.
await page.fill('input[placeholder*="Leia o código"]', 'pote 500ml napolitano');
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.click('button:has-text("Receber")');
await page.waitForTimeout(600);
await page.getByRole('button', { name: /^Dinheiro/ }).click();
await page.fill('input[inputmode="decimal"]', '50,00');
await page.click('button:has-text("Lançar")');
await page.waitForTimeout(400);
await page.click('button:has-text("Concluir venda")');
await page.waitForTimeout(3000);
check('venda em dinheiro registrada', (await page.locator('text=Venda registrada').count()) > 0);

// --- caixa: sangria
await page.keyboard.press('F9');
await page.waitForSelector('text=Fechar o caixa', { timeout: 5000 });
await page.screenshot({ path: '/tmp/caixa-1-menu.png' });

await page.getByRole('button', { name: 'Sangria', exact: true }).click();
await page.waitForSelector('#amount', { timeout: 5000 });
await page.fill('#amount', '20,00');
await page.fill('#reason', 'Deposito no cofre');
await page.click('button:has-text("Confirmar")');
await page.waitForTimeout(2000);
check('sangria listada no turno', (await page.locator('text=Deposito no cofre').count()) > 0);
await page.screenshot({ path: '/tmp/caixa-2-sangria.png' });

const sangrias = Number(psql("select count(*) from cash_movement where kind = 'withdrawal'"));
check('sangria gravada no servidor', sangrias > 0, `${sangrias} lançamento(s)`);

// --- fechamento com contagem errada: precisa exigir justificativa
await page.getByRole('button', { name: 'Fechar o caixa', exact: true }).click();
await page.waitForSelector('text=Conte o que está na gaveta', { timeout: 5000 });
await page.screenshot({ path: '/tmp/caixa-3-conferencia.png' });

await page.fill('input[aria-label="Valor contado em Dinheiro"]', '10,00');
await page.click('button:has-text("Conferir e fechar")');
await page.waitForTimeout(2000);
check(
  'recusa fechar com diferença sem justificativa',
  (await page.locator('text=Escreva o que explica a diferença').count()) > 0,
);

// --- agora com justificativa
await page.fill('#notes', 'Faltou troco, conferido com o gerente');
await page.click('button:has-text("Conferir e fechar")');
await page.waitForSelector('text=Caixa fechado', { timeout: 10000 });
await page.screenshot({ path: '/tmp/caixa-4-resultado.png' });

const resultado = await page.locator('table').innerText();
check('resultado mostra esperado, contado e diferença', /Dinheiro/.test(resultado));

const fechada = psql(
  "select status || ' ' || coalesce(difference_cents::text,'-') from cash_session where status = 'closed' order by closed_at desc limit 1",
);
check('sessão fechada no servidor com a diferença', fechada.startsWith('closed'), fechada);

await page.click('button:has-text("Encerrar turno")');
await page.waitForTimeout(1500);
check('terminal volta para a abertura de caixa', (await page.locator('text=Abrir o caixa').count()) > 0);

// --- relatório impresso
await page.waitForTimeout(1000);
const impresso = existsSync(RECEIPT_FILE) ? readFileSync(RECEIPT_FILE, 'latin1') : '';
check('relatório de fechamento foi impresso', impresso.includes('FECHAMENTO DE CAIXA'));
check('relatório traz a sangria do turno', impresso.includes('Sangria'));
check('relatório traz a assinatura do operador', impresso.includes('Assinatura do operador'));

await browser.close();
console.log(failures === 0 ? '\nFechamento de caixa funcionando.\n' : `\n${failures} verificação(ões) falharam.\n`);
process.exit(failures > 0 ? 1 : 0);
