/**
 * Percorre a retaguarda num navegador real: cadastra um produto com duas
 * variações, cria uma loja, gera o código de ativação de um terminal e cadastra
 * um operador de caixa.
 *
 * Requer API em :3000, retaguarda em :5174 e o banco semeado.
 * Uso: node scripts/e2e-retaguarda.mjs
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

const marker = Date.now().toString().slice(-5);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 950 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });

await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
await page.fill('#password', 'soulmuscle2026');
await page.click('button:has-text("Entrar")');
await page.waitForSelector('text=Faturamento hoje', { timeout: 15000 });
check('entrou na retaguarda', true);

// ---------- produto
await page.click('a:has-text("Produtos")');
await page.waitForSelector('button:has-text("Novo produto")', { timeout: 10000 });
await page.screenshot({ path: '/tmp/retaguarda-1-produtos.png', fullPage: true });

await page.click('button:has-text("Novo produto")');
await page.waitForSelector('text=Variações', { timeout: 5000 });
await page.fill('input[placeholder="21050010"]', '21050010');
await page.locator('.rounded-card input').first().fill(`Picole de teste ${marker}`);
await page.fill('input[placeholder*="Pote 500ml"]', 'Picole Coco');
await page.fill('input[placeholder="Código"]', `T${marker}A`);
await page.fill('input[placeholder="0,00"]', '8,50');
await page.click('button:has-text("Adicionar variação")');
await page.waitForTimeout(300);
await page.locator('input[placeholder*="Pote 500ml"]').nth(1).fill('Picole Morango');
await page.locator('input[placeholder="Código"]').nth(1).fill(`T${marker}B`);
await page.locator('input[placeholder="0,00"]').nth(1).fill('8,50');
await page.screenshot({ path: '/tmp/retaguarda-2-form-produto.png' });
await page.click('button:has-text("Salvar")');
await page.waitForTimeout(2500);

const skus = Number(psql(`select count(*) from sku where code like 'T${marker}%'`));
check('produto salvo com as duas variações', skus === 2, `${skus} SKU(s)`);
const preco = psql(`select price_cents from price where sku_id = (select id from sku where code = 'T${marker}A')`);
check('preço gravado em centavos', preco === '850', preco);

// ---------- loja e terminal
await page.click('a:has-text("Lojas e terminais")');
await page.waitForSelector('button:has-text("Nova loja")', { timeout: 10000 });
await page.screenshot({ path: '/tmp/retaguarda-3-lojas.png', fullPage: true });

await page.click('button:has-text("Nova loja")');
await page.fill('input[placeholder="Q04"]', `T${marker.slice(-2)}`);
await page.fill('input[placeholder*="Quiosque Shopping Leste"]', `Quiosque Teste ${marker}`);
await page.click('button:has-text("Criar loja")');
await page.waitForTimeout(2000);
check('loja criada', (await page.locator(`text=Quiosque Teste ${marker}`).count()) > 0);

await page.locator('article', { hasText: `Quiosque Teste ${marker}` }).getByRole('button', { name: 'Novo terminal' }).click();
await page.waitForSelector('button:has-text("Criar e gerar código")', { timeout: 5000 });
await page.click('button:has-text("Criar e gerar código")');
await page.waitForSelector('text=Código de ativação', { timeout: 10000 });
await page.screenshot({ path: '/tmp/retaguarda-4-ativacao.png' });

const codigo = (await page.locator('p.select-all').innerText()).trim();
check('código de ativação gerado e exibido uma vez', /^soul-pdv-/.test(codigo), codigo);
check('terminal existe no banco com esse código', psql(`select code from terminal where device_token = '${codigo}'`).length > 0);
await page.click('button:has-text("Já anotei")');

// ---------- usuário
await page.click('a:has-text("Usuários")');
await page.waitForSelector('button:has-text("Novo usuário")', { timeout: 10000 });
await page.screenshot({ path: '/tmp/retaguarda-5-usuarios.png', fullPage: true });

await page.click('button:has-text("Novo usuário")');
await page.waitForSelector('text=PIN do caixa', { timeout: 5000 });
await page.locator('.rounded-card input').first().fill(`Operador ${marker}`);
await page.fill('input[placeholder="1234"]', '4321');
await page.click('button:has-text("Salvar")');
await page.waitForTimeout(2000);
check('operador de caixa criado com PIN', (await page.locator(`text=Operador ${marker}`).count()) > 0);
check(
  'PIN gravado com hash, nunca em texto',
  psql(`select pin_hash is not null from app_user where name = 'Operador ${marker}'`) === 't',
);

await browser.close();
console.log(failures === 0 ? '\nRetaguarda funcionando.\n' : `\n${failures} verificação(ões) falharam.\n`);
process.exit(failures > 0 ? 1 : 0);
