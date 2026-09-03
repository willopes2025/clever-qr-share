/**
 * Ficha técnica e produção, pelo navegador.
 *
 * O motor da calda→sorvete existia e estava provado, mas só pela API — sem
 * tela ninguém consegue cadastrar a ficha do quiosque, e o modelo de sorvete
 * expresso não sai do papel. Este roteiro faz o caminho de quem monta a
 * operação: abrir a ficha de um item, escolher quando a baixa acontece,
 * declarar o rendimento e apontar uma produção medindo o que saiu.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = process.env.SHOT_DIR ?? '/tmp';

const fails = [];
const ok = (n, c, e = '') => { console.log(`  ${c ? 'ok  ' : 'FALHA'} ${n}${e ? ' — ' + e : ''}`); if (!c) fails.push(n); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage();
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.fill('#password', 'soulmuscle2026');
await p.click('button:has-text("Entrar")');
await p.waitForTimeout(2500);

// --- Ficha técnica, dentro do cadastro de produto ---
await p.locator('a:has-text("Produtos")').first().click();
await p.waitForTimeout(2500);

const ficha = p.getByRole('button', { name: 'ficha', exact: true }).first();
ok('cada variação tem botão de ficha', await ficha.isVisible());
await ficha.click();
await p.waitForTimeout(2000);

const dialogo = await p.locator('body').innerText();
ok('diálogo da ficha abre', /Ficha técnica/.test(dialogo));
ok('explica quando a baixa acontece', /Na venda|No apontamento/.test(dialogo));
ok('pede o rendimento', /Rendimento/i.test(dialogo));
await p.screenshot({ path: `${SHOT}/ficha-1.png`, fullPage: true });

// Escolher produção muda a explicação — é a diferença que confunde quem cadastra.
const seletorTipo = p.locator('div.fixed.inset-0 select').filter({ hasText: /Na venda/ }).first();
await seletorTipo.selectOption('production');
await p.waitForTimeout(500);
ok('trocar para produção muda a explicação',
   /entra no estoque pelo apontamento/i.test(await p.locator('body').innerText()));

await p.getByRole('button', { name: 'Cancelar' }).click();
await p.waitForTimeout(800);

// --- Produção, dentro do estoque ---
await p.locator('a:has-text("Estoque")').first().click();
await p.waitForTimeout(2500);

const botaoProducao = p.getByRole('button', { name: 'Produção', exact: true });
ok('estoque tem botão de produção', await botaoProducao.isVisible());
await botaoProducao.click();
await p.waitForTimeout(2500);

const producao = await p.locator('body').innerText();
ok('diálogo de produção abre', /Produção/.test(producao));
ok('pede o que saiu, não o previsto', /medido na saída/i.test(producao));
ok('pede as bateladas', /Bateladas/i.test(producao));
ok('mostra o histórico de rendimento', /Produções recentes/i.test(producao));
await p.screenshot({ path: `${SHOT}/producao-1.png`, fullPage: true });

const registrar = p.getByRole('button', { name: /Registrar produção/ });
ok('registrar fica travado sem preencher', await registrar.isDisabled());

// --- Ciclo completo: apontar uma produção de verdade pela tela ---
// O granel do roteiro da API tem ficha de produção cadastrada; usá-lo prova
// que a tela conversa com o mesmo motor já testado.
const seletorSaida = p.locator('div.fixed.inset-0 select').first();
const opcoes = await seletorSaida.locator('option').allTextContents();
const granel = opcoes.find((o) => /Sorvete Granel/.test(o));

if (granel) {
  await seletorSaida.selectOption({ label: granel });
  await p.waitForTimeout(400);
  const campos = p.locator('div.fixed.inset-0 input[inputmode="decimal"]');
  await campos.nth(0).fill('6,84');
  await campos.nth(1).fill('1');
  await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Registrar produção/ }).click();
  await p.waitForTimeout(3500);

  const depois = await p.locator('body').innerText();
  ok('produção registrada mostra o rendimento medido', /rendimento 95%/i.test(depois),
     (depois.match(/rendimento \d+%/i) || [''])[0]);
  ok('mostra previsto e o que saiu', /previsto 7\.2/.test(depois) || /previsto 7,2/.test(depois));
  ok('entra no histórico', /Produções recentes/i.test(depois));
  await p.screenshot({ path: `${SHOT}/producao-2-registrada.png`, fullPage: true });
} else {
  ok('granel com ficha disponível para apontar', false, 'nenhum item Sorvete Granel na lista');
}

await b.close();
console.log(fails.length ? `\n${fails.length} falha(s): ${fails.join(', ')}` : '\nTudo certo.');
process.exit(fails.length ? 1 : 0);
