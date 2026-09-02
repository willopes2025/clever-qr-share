/**
 * Verifica o pacote de produção: um único processo servindo a retaguarda em /,
 * o PDV em /pdv e a API em /v1, com as rotas internas de cada aplicação
 * respondendo em recarga direta.
 *
 * Requer o release construído (./scripts/build-release.sh) e a API no ar.
 * Uso: node scripts/e2e-producao.mjs [http://localhost:3000]
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const psql = (sql) =>
  execSync(
    `su postgres -c "/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -U soul -d soul_erp -t -A -c \\"${sql}\\""`,
  ).toString().trim();

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

// ---------- retaguarda
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#password', 'soulmuscle2026');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('text=Faturamento hoje', { timeout: 15000 });
check('retaguarda abre em / e autentica', true);

await page.click('a:has-text("Lojas e terminais")');
await page.waitForSelector('button:has-text("Nova loja")', { timeout: 10000 });

// Recarregar numa rota interna é o teste que quebra em servidor mal configurado.
await page.reload({ waitUntil: 'networkidle' });
check('recarregar /lojas continua na retaguarda', (await page.locator('button:has-text("Nova loja")').count()) > 0);

// ---------- PDV no mesmo domínio
const deviceToken = psql('select device_token from terminal where app_version is not null order by fiscal_series limit 1');
const pdv = await browser.newPage({ viewport: { width: 1366, height: 820 } });
await pdv.goto(`${BASE}/pdv/`, { waitUntil: 'networkidle' });
const telaPdv = await pdv.locator('body').innerText();
check(
  'PDV abre em /pdv do mesmo domínio',
  /Ativar terminal|Quem está no caixa|Total da venda|Abrir o caixa/.test(telaPdv),
  telaPdv.split('\n').filter(Boolean)[0],
);

await pdv.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 20000 });
const scope = await pdv.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? '');
check('service worker registrado no escopo /pdv/', scope.endsWith('/pdv/'), scope);

if (await pdv.locator('#deviceToken').count()) {
  await pdv.fill('#deviceToken', deviceToken);
  await pdv.click('button:has-text("Ativar terminal")');
  await pdv.waitForSelector('text=Quem está no caixa?', { timeout: 15000 });
}
check('terminal pareia contra a API do mesmo domínio', true);
await pdv.screenshot({ path: '/tmp/producao-pdv.png' });

// ---------- API separada do fallback
const apiStatus = await page.evaluate(async (base) => (await fetch(`${base}/v1/health`)).status, BASE);
check('a API não é engolida pelo fallback do SPA', apiStatus === 200, String(apiStatus));

await browser.close();
console.log(failures === 0 ? '\nPacote de produção servindo tudo corretamente.\n' : `\n${failures} verificação(ões) falharam.\n`);
process.exit(failures > 0 ? 1 : 0);
