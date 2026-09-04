/**
 * Cadastro em massa do cardápio do Boulevard.
 *
 * Lê o catálogo abaixo (extraído do PDF do cardápio) e cadastra cada produto
 * via a mesma rota que a retaguarda usa (POST /v1/products). Feito como script
 * porque este ambiente de trabalho não alcança soulmuscle.wideic.com — a
 * política de rede daqui bloqueia a saída. Rode isto de uma máquina com acesso
 * normal à internet.
 *
 * SEGURANÇA: a senha não fica hardcoded aqui de propósito — ela foi digitada
 * em texto puro nesta conversa, então depois de usar este script uma vez,
 * troque a senha do usuário boulevard@soulmuscle.com pela retaguarda.
 *
 * ANTES DE RODAR, confira as duas suposições marcadas com "// ATENÇÃO" no
 * catálogo abaixo — o PDF não deixa claro o suficiente para eu decidir sozinho:
 *
 *   1. Soul Ice (pote): o cardápio mostra dois potes decorados a R$37,90 e um
 *      pote liso a R$17,90, sem rotular explicitamente qual sabor/tamanho é
 *      qual. Assumi: R$37,90 = pote grande, disponível nos dois sabores
 *      (Dream e Pistacchio); R$17,90 = pote pequeno, também nos dois sabores.
 *      Se estiver errado, corrija os priceCents antes de confirmar.
 *
 *   2. NCM/CEST: usei o mesmo enquadramento da Soul Muscle original — sorvete
 *      NCM 21050010 + CEST 23.001.00 (substituição tributária, ES) e água
 *      NCM 22011000 + CEST 03.006.00. Isso PRECISA ser confirmado pelo
 *      contador do Boulevard antes da primeira venda — o enquadramento varia
 *      por estado e o CONFAZ muda a lista de tempos em tempos.
 *
 * MODELAGEM: "monte seu sorvete" (creme/calda + crocante à escolha) não vira
 * SKU por combinação — o preço não muda com a escolha, e o sistema hoje não
 * tem "opcional de venda" (modificador). Cada tamanho vira uma SKU só; o sabor
 * escolhido fica por conta do operador no balcão, sem controle de estoque por
 * escolha. Se quiser que o granel/creme desça do estoque por sabor
 * efetivamente usado, isso é ficha técnica por SKU — outro passo, depois deste.
 *
 * USO:
 *   BOULEVARD_URL=https://soulmuscle.wideic.com \
 *   BOULEVARD_EMAIL=boulevard@soulmuscle.com \
 *   BOULEVARD_PASSWORD='...' \
 *   node scripts/cadastro-boulevard.mjs            # mostra prévia, não grava nada
 *
 *   ...mesma linha... node scripts/cadastro-boulevard.mjs --confirmar
 *                                                    # grava de verdade
 */

const BASE = process.env.BOULEVARD_URL;
const EMAIL = process.env.BOULEVARD_EMAIL;
const PASSWORD = process.env.BOULEVARD_PASSWORD;
const CONFIRMAR = process.argv.includes('--confirmar') || process.env.CONFIRMAR === '1';

if (!BASE || !EMAIL || !PASSWORD) {
  console.error('Defina BOULEVARD_URL, BOULEVARD_EMAIL e BOULEVARD_PASSWORD antes de rodar.');
  process.exit(1);
}

const API = `${BASE.replace(/\/$/, '')}/v1`;

// ---------------------------------------------------------------------------
// Catálogo extraído do cardápio (6 páginas).
// ---------------------------------------------------------------------------

const SORVETE_FISCAL = { ncm: '21050010', cest: '23.001.00' };
const AGUA_FISCAL = { ncm: '22011000', cest: '03.006.00' };

const catalogo = [
  {
    name: 'Soul Cup Tradicional',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'CUP-T-P', description: 'Soul Cup Tradicional P - 80ml', priceCents: 1290 },
      { code: 'CUP-T-M', description: 'Soul Cup Tradicional M - 120ml', priceCents: 1890 },
      { code: 'CUP-T-G', description: 'Soul Cup Tradicional G - 160ml', priceCents: 2390 },
      { code: 'CUP-T-GG', description: 'Soul Cup Tradicional GG - 200ml', priceCents: 3490 },
    ],
  },
  {
    name: 'Soul Cup Premium',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'CUP-P-P', description: 'Soul Cup Premium P - 80ml', priceCents: 1990 },
      { code: 'CUP-P-M', description: 'Soul Cup Premium M - 120ml', priceCents: 2690 },
      { code: 'CUP-P-G', description: 'Soul Cup Premium G - 160ml', priceCents: 3490 },
      { code: 'CUP-P-GG', description: 'Soul Cup Premium GG - 200ml', priceCents: 4690 },
    ],
  },
  {
    name: 'Soul Crunch Tradicional',
    ...SORVETE_FISCAL,
    skus: [{ code: 'CRU-T', description: 'Soul Crunch Tradicional', priceCents: 990 }],
  },
  {
    name: 'Soul Crunch Premium',
    ...SORVETE_FISCAL,
    skus: [{ code: 'CRU-P', description: 'Soul Crunch Premium', priceCents: 2390 }],
  },
  {
    name: 'Soul Sundae',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'SUN-FRUTVERM', description: 'Soul Sundae Frutas Vermelhas', priceCents: 2690 },
      { code: 'SUN-ABACAXI', description: 'Soul Sundae Abacaxi ao Vinho', priceCents: 2690 },
      { code: 'SUN-AMARENA', description: 'Soul Sundae Amarena', priceCents: 2690 },
      { code: 'SUN-MORANGO', description: 'Soul Sundae Morango', priceCents: 2690 },
      { code: 'SUN-MARACUJA', description: 'Soul Sundae Maracujá', priceCents: 2690 },
    ],
  },
  {
    // Cardápio traz duas versões deste produto (pág. 2 e pág. 5) com preço e
    // sabores diferentes. Fiquei com a da pág. 2, conforme confirmado.
    name: 'Soul Shake',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'SHK-PACDL', description: 'Soul Shake Paçoca com Doce de Leite', priceCents: 3690 },
      { code: 'SHK-PACNH', description: 'Soul Shake Paçoca com Ninho', priceCents: 3690 },
      { code: 'SHK-DOLCE', description: 'Soul Shake Dolce', priceCents: 3690 },
      { code: 'SHK-CHOC', description: 'Soul Shake Chocolate', priceCents: 3690 },
      { code: 'SHK-MORANGO', description: 'Soul Shake Morango', priceCents: 3690 },
      { code: 'SHK-DREAM', description: 'Soul Shake Dream', priceCents: 3690 },
      { code: 'SHK-PISTACCHIO', description: 'Soul Shake Pistacchio', priceCents: 3690 },
      { code: 'SHK-MARACUJA', description: 'Soul Shake Maracujá', priceCents: 3690 },
      { code: 'SHK-LIMAO', description: 'Soul Shake Limão', priceCents: 3690 },
      { code: 'SHK-FRAPPUCINO', description: 'Soul Shake Frappucino', priceCents: 3690 },
    ],
  },
  {
    // ATENÇÃO — ver suposição nº 1 no cabeçalho do arquivo.
    name: 'Soul Ice',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'ICE-DREAM-G', description: 'Soul Ice Dream Grande', priceCents: 3790 },
      { code: 'ICE-DREAM-P', description: 'Soul Ice Dream Pequeno', priceCents: 1790 },
      { code: 'ICE-PIST-G', description: 'Soul Ice Pistacchio Grande', priceCents: 3790 },
      { code: 'ICE-PIST-P', description: 'Soul Ice Pistacchio Pequeno', priceCents: 1790 },
    ],
  },
  {
    name: 'Soul Ice Casquinha',
    ...SORVETE_FISCAL,
    skus: [
      { code: 'ICE-CONE-AVELA', description: 'Casquinha Premium Avelã', priceCents: 2490 },
      { code: 'ICE-CONE-PIST', description: 'Casquinha Premium Pistache', priceCents: 2490 },
      { code: 'ICE-CONE-TRAD', description: 'Casquinha Tradicional', priceCents: 2190 },
    ],
  },
  {
    name: 'Água',
    ...AGUA_FISCAL,
    skus: [
      { code: 'AGUA-CGAS', description: 'Água com Gás', priceCents: 990 },
      { code: 'AGUA-SGAS', description: 'Água sem Gás', priceCents: 990 },
    ],
  },
];

// ---------------------------------------------------------------------------

function money(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? `${path} → ${response.status}`);
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

const totalSkus = catalogo.reduce((total, produto) => total + produto.skus.length, 0);

console.log(`Soul ERP — cadastro do Boulevard em ${BASE}\n`);
console.log(`${catalogo.length} produtos, ${totalSkus} variações no total.\n`);

const login = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
console.log(`Login ok: ${login.user.name} <${EMAIL}>`);

// Confirmação de identidade: mostra as lojas do tenant autenticado, para quem
// rodar o script enxergar que caiu no cliente certo antes de qualquer gravação.
const stores = await call('/stores', { token: login.accessToken });
console.log(`Lojas deste tenant: ${stores.map((s) => s.name).join(', ') || '(nenhuma cadastrada ainda)'}\n`);

console.log('--- prévia do que será cadastrado ---\n');
for (const produto of catalogo) {
  console.log(`${produto.name}  [NCM ${produto.ncm} · CEST ${produto.cest}]`);
  for (const sku of produto.skus) {
    console.log(`   ${sku.code.padEnd(16)} ${sku.description.padEnd(38)} ${money(sku.priceCents)}`);
  }
}

if (!CONFIRMAR) {
  console.log('\nPrévia apenas — nada foi gravado. Confira o catálogo acima e as duas');
  console.log('suposições marcadas no cabeçalho do arquivo, depois rode de novo com --confirmar.');
  process.exit(0);
}

console.log('\n--- gravando ---\n');
let criados = 0;
let existentes = 0;
let falhas = 0;

for (const produto of catalogo) {
  try {
    await call('/products', { method: 'POST', token: login.accessToken, body: produto });
    console.log(`ok    ${produto.name}`);
    criados += 1;
  } catch (error) {
    if (error.code === 'SKU_CODE_IN_USE' || error.code === 'BARCODE_IN_USE') {
      console.log(`existe ${produto.name} — já cadastrado, pulando`);
      existentes += 1;
    } else {
      console.log(`FALHA ${produto.name} — ${error.message}`);
      falhas += 1;
    }
  }
}

console.log(`\n${criados} criado(s), ${existentes} já existiam, ${falhas} falharam.`);
if (falhas > 0) process.exit(1);
