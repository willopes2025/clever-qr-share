// Envio manual de um orçamento específico (botão "Enviar orçamento" no modal).
import { createClient } from "npm:@supabase/supabase-js@2";
import { gpCall, normalizePaged } from "../_shared/gestaoPartsErp.ts";
import { resolveCreds } from "../_shared/gestaoPartsStatus.ts";
import { buildMessage, extractPhone, orcamentoNumero, resolveOwner, sendOrcamento, type Row } from "../_shared/gestaoPartsOrcamento.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const numero = String(body.numero || '').trim();
    if (!numero) throw new Error('Informe o número do orçamento');

    const creds = await resolveCreds(admin);
    let row: Row | null = (body.row && typeof body.row === 'object') ? body.row as Row : null;

    if (!row) {
      const raw = await gpCall(creds, 'GET', '/erpssplus/pedido/requisicao', { requisicao: numero });
      const list = normalizePaged(raw, ['pedidos']);
      row = list.items[0] || null;
    }
    if (!row) throw new Error(`Orçamento ${numero} não encontrado no ERP`);
    if (!orcamentoNumero(row)) row.numpedido = numero;

    const { data: config } = await admin
      .from('gestao_parts_orcamento_config').select('message_template').eq('id', 1).maybeSingle();

    // Prévia: devolve o texto que seria enviado, para o vendedor revisar/editar
    if (body.preview === true) {
      return new Response(JSON.stringify({
        status: 'preview',
        numero,
        telefone: extractPhone(row),
        text: buildMessage(row, config?.message_template ?? null),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ctx = await resolveOwner(admin);
    const result = await sendOrcamento(admin, row, {
      origin: 'manual',
      force: body.force === true,
      template: config?.message_template ?? null,
      overrideText: typeof body.text === 'string' ? body.text : null,
      ctx,
    });

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[GP-ORC-SEND]', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
