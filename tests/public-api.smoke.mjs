#!/usr/bin/env node

/**
 * Smoke Tests — WideZap Public API
 *
 * Uso: node tests/public-api.smoke.mjs
 * Requer: node >= 18
 *
 * Configuração via variáveis de ambiente ou edite as constantes abaixo:
 *   PUBLIC_API_BASE  — base URL da public-api
 *   API_KEY          — chave de API para autenticação
 *   SUPABASE_URL     — URL do projeto Supabase (para endpoints admin)
 *   SUPABASE_ANON_KEY — anon key do projeto
 *   TEST_USER_EMAIL  — email do usuário de teste
 *   TEST_USER_PASS   — senha do usuário de teste
 */

const BASE = process.env.PUBLIC_API_BASE || "https://yxhjwpoaloqcnocpiyui.supabase.co/functions/v1/public-api/v1";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://yxhjwpoaloqcnocpiyui.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aGp3cG9hbG9xY25vY3BpeXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjU5OTAsImV4cCI6MjEwMjc0MTk5MH0.cPALC7_IsfuySMhpAcMS23aT8QhGArz-t2yxgqV1xqQ";
const EMAIL = process.env.TEST_USER_EMAIL || "teste@widezap.com";
const PASS = process.env.TEST_USER_PASS || "Widezap2026!";

let API_KEY = process.env.API_KEY || "";
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

async function api(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, headers: res.headers };
}

// ─── SETUP ───────────────────────────────────────────────────

async function setup() {
  console.log("\n🔧 Setup: obtendo API key...");

  if (!API_KEY) {
    // Login para obter JWT
    const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    });
    const login = await loginRes.json();
    if (!login.access_token) {
      console.error("❌ Falha no login:", login);
      process.exit(1);
    }
    const jwt = login.access_token;

    // Verificar se já existe uma key
    const listRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-api-key`, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const list = await listRes.json();
    const existing = (list.data || []).find((k) => !k.revoked_at);

    if (existing) {
      // Não temos a key completa, vamos criar uma nova
      const createRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-api-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "smoke-test-auto" }),
      });
      const created = await createRes.json();
      API_KEY = created.key;
      console.log(`  API Key criada: ${API_KEY.substring(0, 20)}...`);
    } else {
      const createRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-api-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "smoke-test-auto" }),
      });
      const created = await createRes.json();
      API_KEY = created.key;
      console.log(`  API Key criada: ${API_KEY.substring(0, 20)}...`);
    }
  }
}

// ─── TESTES: AUTH ────────────────────────────────────────────

async function testAuth() {
  console.log("\n📋 Auth:");

  // 1. Sem auth → 401
  const r1 = await api("GET", "/contacts");
  assert(r1.status === 401, "Sem auth retorna 401");

  // 2. Key inválida → 401
  const r2 = await api("GET", "/contacts", null, { Authorization: "Bearer wz_live_00000000000000000000000000000000" });
  assert(r2.status === 401, "Key inválida retorna 401");

  // 3. Key válida → 200
  const r3 = await api("GET", "/contacts", null, { Authorization: `Bearer ${API_KEY}` });
  assert(r3.status === 200, "Key válida retorna 200");
}

// ─── TESTES: CONTATOS ───────────────────────────────────────

async function testContacts() {
  console.log("\n📋 Contatos:");
  const h = { Authorization: `Bearer ${API_KEY}` };
  const ts = Date.now();

  // Criar contato
  const c1 = await api("POST", "/contacts", { phone: `119${ts}`.slice(0, 11), name: "Teste Smoke", email: "smoke@test.com" }, h);
  assert(c1.status === 201, "Criar contato retorna 201");
  assert(c1.json?.data?.id, "Contato tem ID");
  const contactId = c1.json?.data?.id;

  // Listar contatos
  const c2 = await api("GET", "/contacts", null, h);
  assert(c2.status === 200, "Listar contatos retorna 200");
  assert(c2.json?.data?.length > 0, "Lista não vazia");
  assert(c2.json?.meta?.total > 0, "Meta total > 0");

  // Buscar por ID
  const c3 = await api("GET", `/contacts/${contactId}`, null, h);
  assert(c3.status === 200, "Buscar por ID retorna 200");
  assert(c3.json?.data?.name === "Teste Smoke", "Nome confere");

  // Buscar por phone
  const c4 = await api("GET", `/contacts?phone=${ts}`, null, h);
  assert(c4.status === 200, "Buscar por phone retorna 200");
  assert(c4.json?.data?.length > 0, "Encontrou contato por phone");

  // Atualizar
  const c5 = await api("PATCH", `/contacts/${contactId}`, { name: "Teste Atualizado", notes: "nota" }, h);
  assert(c5.status === 200, "Atualizar retorna 200");
  assert(c5.json?.data?.name === "Teste Atualizado", "Nome atualizado");

  // Criar duplicado → 409
  const c6 = await api("POST", "/contacts", { phone: `119${ts}`.slice(0, 11), name: "Duplicado" }, h);
  assert(c6.status === 409, "Duplicidade retorna 409");

  // Soft delete
  const c7 = await api("DELETE", `/contacts/${contactId}`, null, h);
  assert(c7.status === 204, "Delete retorna 204");

  // Buscar deletado → 404
  const c8 = await api("GET", `/contacts/${contactId}`, null, h);
  assert(c8.status === 404, "Busca deletado retorna 404");

  // UUID inválido → 400
  const c9 = await api("GET", "/contacts/invalid", null, h);
  assert(c9.status === 400, "UUID inválido retorna 400");

  // Phone com <10 dígitos (busca) → 200 com lista vazia
  const c10 = await api("GET", "/contacts?phone=123", null, h);
  assert(c10.status === 200, "Busca phone curto retorna 200 (lista vazia)");

  // Body vazio no POST → 400
  const c11 = await api("POST", "/contacts", {}, h);
  assert(c11.status === 400, "POST vazio retorna 400");
}

// ─── TESTES: LEADS ──────────────────────────────────────────

async function testLeads() {
  console.log("\n📋 Leads:");
  const h = { Authorization: `Bearer ${API_KEY}` };
  const ts = Date.now();

  // Criar lead com contato automático
  const l1 = await api("POST", "/leads", { phone: `118${ts}`.slice(0, 11), name: "Lead Smoke", title: "Oportunidade", value: 5000 }, h);
  assert(l1.status === 201, "Criar lead com contato automático retorna 201");
  assert(l1.json?.data?.id, "Lead tem ID");
  assert(l1.json?.data?.contact, "Lead tem contact embutido");
  const leadId = l1.json?.data?.id;

  // Criar lead com funnel_id explícito
  const l2 = await api("POST", "/leads", { phone: `117${ts}`.slice(0, 11), name: "Lead Funil", title: "Com Funil", funnel_id: l1.json?.data?.funnel_id }, h);
  assert(l2.status === 201, "Criar lead com funnel_id explícito retorna 201");

  // Criar lead com funnel_id + stage_id
  const l3 = await api("POST", "/leads", { phone: `116${ts}`.slice(0, 11), name: "Lead Estagio", title: "Com Estagio", funnel_id: l1.json?.data?.funnel_id, stage_id: l1.json?.data?.stage_id }, h);
  assert(l3.status === 201, "Criar lead com funnel_id + stage_id retorna 201");

  // Listar leads
  const l4 = await api("GET", "/leads", null, h);
  assert(l4.status === 200, "Listar leads retorna 200");
  assert(l4.json?.meta?.total >= 3, "Pelo menos 3 leads");

  // Buscar lead por ID
  const l5 = await api("GET", `/leads/${leadId}`, null, h);
  assert(l5.status === 200, "Buscar lead por ID retorna 200");
  assert(l5.json?.data?.contact, "Lead retornou contact vinculado");

  // Atualizar lead (mover estágio)
  if (l1.json?.data?.stage_id) {
    const l6 = await api("PATCH", `/leads/${leadId}`, { stage_id: l1.json.data.stage_id }, h);
    assert(l6.status === 200, "Atualizar lead retorna 200");
  }

  // Atualizar custom_fields no formato {custom_field_id, value}
  const l7 = await api("PATCH", `/leads/${leadId}`, { custom_fields: [{ custom_field_id: "field-1", value: "teste" }] }, h);
  assert(l7.status === 200, "Atualizar custom_fields retorna 200");

  // Lead sem dados → 400
  const l8 = await api("POST", "/leads", { title: "sem dados" }, h);
  assert(l8.status === 400, "Lead sem phone/name/contact_id retorna 400");

  // Soft delete lead
  const l9 = await api("DELETE", `/leads/${leadId}`, null, h);
  assert(l9.status === 204, "Deletar lead retorna 204");

  // Buscar lead deletado → 404
  const l10 = await api("GET", `/leads/${leadId}`, null, h);
  assert(l10.status === 404, "Busca lead deletado retorna 404");
}

// ─── TESTES: RATE LIMIT ─────────────────────────────────────

async function testRateLimit() {
  console.log("\n📋 Rate Limit:");
  const h = { Authorization: `Bearer ${API_KEY}` };

  // Enviar 6 requisições rápidas
  let rateLimited = false;
  for (let i = 0; i < 7; i++) {
    const r = await api("GET", "/contacts", null, h);
    if (r.status === 429) {
      rateLimited = true;
      assert(true, `Requisição ${i + 1}: 429 rate limited`);
      break;
    }
  }
  if (!rateLimited) {
    assert(false, "Rate limit não foi atingido após 6+ requisições");
  }
}

// ─── TESTES: ENVELOPE PADRÃO ────────────────────────────────

async function testEnvelope() {
  console.log("\n📋 Envelope de resposta:");
  const h = { Authorization: `Bearer ${API_KEY}` };

  // Success envelope tem 'data'
  const r1 = await api("GET", "/contacts", null, h);
  assert("data" in (r1.json || {}), "Resposta de sucesso tem 'data'");

  // Error envelope tem 'error'
  const r2 = await api("GET", "/contacts/invalid", null, h);
  assert("error" in (r2.json || {}), "Resposta de erro tem 'error'");
  assert(r2.json?.error?.code, "Erro tem 'code'");
  assert(r2.json?.error?.message, "Erro tem 'message'");

  // Rate limit headers
  const r3 = await api("GET", "/contacts", null, h);
  assert(r3.headers.get("x-ratelimit-limit") || r3.headers.get("X-RateLimit-Limit"), "Header X-RateLimit-Limit presente");
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log("🧪 WideZap Public API — Smoke Tests\n");
  console.log(`Base: ${BASE}`);

  await setup();

  await testAuth();
  await testContacts();
  await testLeads();
  await testEnvelope();
  await testRateLimit();

  console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("❌ Erro fatal:", e);
  process.exit(1);
});
