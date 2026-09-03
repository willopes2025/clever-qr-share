/**
 * A tela de estoque, pelo navegador.
 *
 * Cobre o que a API sozinha não prova: que dá para dar entrada e contar sem
 * saber o id de nada — que era o buraco real, já que a lógica existia e só não
 * tinha porta nem tela.
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

const link = p.locator('a:has-text("Estoque")').first();
ok('menu tem Estoque', await link.isVisible());
await link.click();
await p.waitForTimeout(2500);

const body = await p.locator('body').innerText();
ok('tela abre com a lista', /Saldo|Custo médio/i.test(body));
ok('tem botão de entrada', await p.locator('button:has-text("Registrar entrada")').isVisible());
ok('tem botão de contagem', await p.locator('button:has-text("Fazer contagem")').isVisible());
await p.screenshot({ path: `${SHOT}/estoque-1-lista.png`, fullPage: true });

// Entrada de mercadoria pela tela.
await p.click('button:has-text("Registrar entrada")');
await p.waitForTimeout(1200);
ok('diálogo de entrada abre', /Registrar entrada de mercadoria/i.test(await p.locator('body').innerText()));

const seletor = p.locator('select').nth(1);
const opcoes = await seletor.locator('option').allTextContents();
const alvo = opcoes.find((o) => o !== 'Selecione');
await seletor.selectOption({ label: alvo });
const campos = p.locator('input[inputmode="decimal"]');
await campos.nth(0).fill('15');
await campos.nth(1).fill('9,50');
await p.screenshot({ path: `${SHOT}/estoque-2-entrada.png`, fullPage: true });
await p.click('button:has-text("Dar entrada")');
await p.waitForTimeout(3000);

const depois = await p.locator('body').innerText();
ok('entrada fecha o diálogo e volta à lista', !/Registrar entrada de mercadoria/i.test(depois));
ok('custo médio aparece na lista', /R\$/.test(depois), alvo);
await p.screenshot({ path: `${SHOT}/estoque-3-depois.png`, fullPage: true });

// Contagem pela tela.
await p.click('button:has-text("Fazer contagem")');
await p.waitForTimeout(1500);
ok('diálogo de contagem abre', /Contagem de inventário/i.test(await p.locator('body').innerText()));
const contados = p.locator('input[placeholder="contado"]');
await contados.first().fill('7');
await p.getByRole("button", { name: /Registrar \d+ item/ }).click();
await p.waitForTimeout(2500);
const resultado = await p.locator('body').innerText();
ok('contagem mostra o que estava diferente', /Contagem registrada/i.test(resultado));
ok('mostra sistema x contado', /sistema .* contado/i.test(resultado));
await p.screenshot({ path: `${SHOT}/estoque-4-contagem.png`, fullPage: true });

await b.close();
console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
