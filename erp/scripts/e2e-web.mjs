/**
 * Abre a retaguarda num navegador real, entra com o usuário do seed e captura
 * o painel completo em /tmp/web-*.png.
 *
 * Requer a API em :3000 e a retaguarda servida em :5174.
 * Uso: node scripts/e2e-web.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/web-1-login.png' });

await page.fill('#password', 'soulmuscle2026');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('text=Faturamento hoje', { timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/web-2-dashboard.png', fullPage: true });

const kpis = await page.locator('main section').first().innerText();
console.log('\nKPIs:\n' + kpis);
await browser.close();
