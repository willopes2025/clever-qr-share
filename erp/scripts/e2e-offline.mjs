/**
 * Prova que o PDV abre e vende com a internet caída.
 *
 * Abre o terminal online, deixa o service worker guardar o app, corta a rede,
 * recarrega a página e faz uma venda inteira offline. Depois devolve a rede e
 * confere que a venda subiu sozinha e virou nota fiscal.
 *
 * Requer a API em :3000, o PDV servido em :5173 e o banco semeado.
 * Uso: node scripts/e2e-offline.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

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
const salesBefore = Number(psql('select count(*) from sale'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
const page = await context.newPage();

// --- online: pareia, escolhe operador e abre o caixa
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
check('terminal preparado com internet', true);

// O service worker precisa terminar de guardar o app antes de cortarmos a rede.
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });
check('service worker no comando da página', true);

// --- corta a internet e recarrega: é aqui que um site comum quebraria
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
const abriu = await page.locator('text=Total da venda').count();
check('PDV abre com a internet caída', abriu > 0);
await page.screenshot({ path: '/tmp/pdv-offline.png' });

// --- vende offline
await page.fill('input[placeholder*="Leia o código"]', 'pote 500ml napolitano');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.fill('input[placeholder*="Leia o código"]', 'casquinha');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(600);

await page.click('button:has-text("Receber")');
await page.waitForSelector('text=Bandeira', { timeout: 5000 });
await page.click('button:has-text("Lançar")');
await page.waitForTimeout(300);
await page.click('button:has-text("Concluir venda")');
await page.waitForTimeout(1500);

const registrou = await page.locator('text=Venda registrada').count();
check('venda concluída offline', registrou > 0);

const statusOffline = await page.locator('header').innerText();
check('barra mostra offline e fila', /OFFLINE/i.test(statusOffline) && /FILA/i.test(statusOffline),
  statusOffline.replace(/\n/g, ' | '));
await page.screenshot({ path: '/tmp/pdv-offline-venda.png' });

const durante = Number(psql('select count(*) from sale'));
check('nada chegou ao servidor enquanto offline', durante === salesBefore, `${durante} vendas`);

// --- devolve a internet: a fila precisa drenar sozinha
await context.setOffline(true);
await context.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(9000);

const depois = Number(psql('select count(*) from sale'));
check('venda subiu sozinha quando a internet voltou', depois === salesBefore + 1, `${depois} vendas`);

const statusOnline = await page.locator('header').innerText();
check('fila esvaziou na barra de status', !/FILA/i.test(statusOnline), statusOnline.replace(/\n/g, ' | '));

await page.waitForTimeout(12000);
const comNota = psql(
  "select coalesce(f.status::text,'sem documento') from sale s left join fiscal_document f on f.sale_id = s.id order by s.received_at desc limit 1",
);
check('nota da venda offline foi autorizada', comNota === 'authorized', comNota);

await page.screenshot({ path: '/tmp/pdv-voltou-online.png' });
await browser.close();

console.log(failures === 0 ? '\nO PDV abre e vende sem internet.\n' : `\n${failures} verificação(ões) falharam.\n`);
process.exit(failures > 0 ? 1 : 0);
