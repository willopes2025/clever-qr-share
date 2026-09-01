/**
 * Percorre o PDV num navegador real: pareia o terminal, escolhe o operador,
 * abre o caixa, vende um item por peso e um avulso, recebe em cartão e conclui.
 * Salva uma captura de cada passo em /tmp/pdv-*.png.
 *
 * Requer a API em :3000, o PDV servido em :5173 e o banco semeado.
 * Uso: node scripts/e2e-pdv.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const deviceToken = execSync(
  `su postgres -c "/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -U soul -d soul_erp -t -A -c \\"select device_token from terminal order by fiscal_series limit 1\\""`,
).toString().trim();

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const shot = (name) => page.screenshot({ path: `/tmp/pdv-${name}.png` });

page.on('console', (msg) => { if (msg.type() === 'error') console.log('  console:', msg.text()); });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await shot('1-pareamento');

await page.fill('#deviceToken', deviceToken);
await page.click('button:has-text("Ativar terminal")');
await page.waitForSelector('text=Quem está no caixa?', { timeout: 15000 });
await shot('2-operador');

await page.click('button:has-text("Camila")');
await page.waitForTimeout(800);

if (await page.locator('text=Abrir o caixa').count()) {
  await page.click('button:has-text("Abrir caixa")');
  await page.waitForTimeout(1200);
}
await page.waitForSelector('text=Total da venda', { timeout: 15000 });
await shot('3-venda-vazia');

// Vende um item por peso (balança fora do ar → digitação) e um avulso.
await page.fill('input[placeholder*="Leia o código"]', 'acai');
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(1800);
if (await page.locator('#grams').count()) {
  await page.fill('#grams', '412');
  await shot('4-peso');
  await page.click('button:has-text("Adicionar")');
}
await page.fill('input[placeholder*="Leia o código"]', 'granola');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
await shot('5-carrinho');

await page.click('button:has-text("Receber")');
await page.waitForSelector('text=Bandeira', { timeout: 5000 });
await page.click('button:has-text("Lançar")');
await page.waitForTimeout(400);
await shot('6-pagamento');

await page.click('button:has-text("Concluir venda")');
await page.waitForTimeout(2500);
await shot('7-concluida');

const badge = await page.locator('header').innerText();
console.log('\nbarra de status:', badge.replace(/\n/g, ' | '));
await browser.close();
console.log('capturas em /tmp/pdv-*.png');
