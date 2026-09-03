/**
 * Troca de turno no PDV.
 *
 * O operador ficava preso na tela: a única saída era fechar o caixa. Quem saía
 * para o almoço deixava a gaveta aberta no próprio nome, e a venda seguinte
 * entrava como se fosse dele.
 *
 * Este roteiro cobre o caminho inteiro: sair, trocar de operador sem fechar o
 * caixa, e o próximo assumir a mesma sessão.
 */
import { chromium } from 'playwright';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = '/tmp/claude-0/-home-user-clever-qr-share/8653b34f-12ce-5fea-9fa7-69cfae1f1b98/scratchpad';

const fails = [];
const ok = (n, c, e = '') => { console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${e ? ' — ' + e : ''}`); if (!c) fails.push(n); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage();

await p.goto('http://127.0.0.1:3000/pdv/', { waitUntil: 'networkidle' });
await p.fill('#deviceToken', 'soul-pdv-q01-6a2634b4');
await p.click('button:has-text("Ativar terminal")');
await p.waitForTimeout(3000);

await p.locator('button, [role=button]').filter({ hasText: 'Camila Souza' }).first().click();
await p.waitForTimeout(3000);

const naVenda = /Carrinho vazio|TOTAL DA VENDA|Receber/.test(await p.locator('body').innerText());
ok('chega na tela de venda', naVenda);

const botaoSair = p.locator('button:has-text("sair")').first();
ok('barra tem botão SAIR', await botaoSair.isVisible());
await p.screenshot({ path: `${SHOT}/sair-1-barra.png`, fullPage: true });

await botaoSair.click();
await p.waitForTimeout(1200);
const dialogo = await p.locator('body').innerText();
ok('abre o diálogo de saída', /Sair do caixa/.test(dialogo));
ok('diz que o caixa continua aberto', /caixa continua aberto/i.test(dialogo));
ok('oferece desconectar o terminal', /desconectar este terminal/i.test(dialogo));
await p.screenshot({ path: `${SHOT}/sair-2-dialogo.png`, fullPage: true });

// ESC fecha, como o próprio diálogo promete.
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
ok('ESC fecha o diálogo', !/Sair do caixa/.test(await p.locator('body').innerText()));

// Trocar de operador volta para a escolha de quem está no caixa.
await botaoSair.click();
await p.waitForTimeout(800);
await p.locator('button:has-text("Trocar de operador")').click();
await p.waitForTimeout(2000);
const depois = await p.locator('body').innerText();
ok('volta para "Quem está no caixa?"', /Quem está no caixa/i.test(depois));
ok('não pede o código de ativação de novo', !/Ativar este terminal/i.test(depois));
await p.screenshot({ path: `${SHOT}/sair-3-troca.png`, fullPage: true });

// E o próximo operador assume o mesmo caixa, sem reabrir.
await p.locator('button, [role=button]').filter({ hasText: 'Bianca Alves' }).first().click();
await p.waitForTimeout(2500);
const assumiu = await p.locator('body').innerText();
ok('próximo operador cai direto na venda, caixa segue aberto', /TOTAL DA VENDA|Carrinho vazio/.test(assumiu));
ok('barra mostra o novo operador', /BIANCA/i.test(assumiu));
await p.screenshot({ path: `${SHOT}/sair-4-novo-operador.png`, fullPage: true });

await b.close();
console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
