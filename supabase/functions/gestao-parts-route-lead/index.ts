// Roteamento automático de novos contatos (exclusivo do cliente com Gestão Parts ativo).
// Consulta o ERP pelo telefone, lê o vendedor do pedido/orçamento em aberto e
// atribui a conversa ao usuário vinculado em gestao_parts_vendedores.
// Tolerante a falhas: qualquer erro apenas registra log e devolve 200.
import { createClient } from "npm:@supabase/supabase-js@2";
import { gpCall, normalizePaged, onlyDigits, PEDIDO_TIPOS } from "../_shared/gestaoPartsErp.ts";
import { resolveCreds } from "../_shared/gestaoPartsStatus.ts";
import { resolveOwner, resolveVendedorUser, vendedorNome } from "../_shared/gestaoPartsOrcamento.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Row = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Telefone BR -> DDD + número (o ERP não espera o DDI 55)
function toErpPhone(phone: string): string {
  let d = onlyDigits(phone);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d;
}

const OPEN_STATUS_BLOCK = ['CANCELADO', 'CANCELADA', 'FINALIZADO', 'FINALIZADA', 'FATURADO', 'FATURADA'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  try {
    const body = (await req.json().catch(() => ({}))) as {
      conversation_id?: string;
      phone?: string;
    };
    const conversationId = String(body.conversation_id || '');
    if (!conversationId) return json({ ok: false, reason: 'conversation_id obrigatório' });

    // A integração só existe para o cliente Gestão Parts; sem ela nada acontece.
    const { data: integration } = await admin
      .from('integrations').select('id')
      .eq('provider', 'gestao_parts').eq('is_active', true).limit(1).maybeSingle();
    if (!integration) return json({ ok: false, reason: 'integração inativa' });

    const { data: conv } = await admin
      .from('conversations')
      .select('id, user_id, assigned_to, contact_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) return json({ ok: false, reason: 'conversa não encontrada' });
    if (conv.assigned_to) return json({ ok: true, reason: 'já atribuída' });

    // Restringe a organização do dono da integração
    const ctx = await resolveOwner(admin);
    if (!ctx.scopeIds.includes(String(conv.user_id))) {
      return json({ ok: false, reason: 'fora da organização Gestão Parts' });
    }

    let phone = String(body.phone || '');
    if (!phone && conv.contact_id) {
      const { data: contact } = await admin
        .from('contacts').select('phone').eq('id', conv.contact_id).maybeSingle();
      phone = String(contact?.phone || '');
    }
    const erpPhone = toErpPhone(phone);
    if (erpPhone.length < 10) return json({ ok: false, reason: 'telefone inválido' });

    const creds = await resolveCreds(admin);

    let clienteCodigo = '';
    try {
      const pessoa = await gpCall(creds, 'GET', `/erpssplus/pessoas/${encodeURIComponent(erpPhone)}`) as Row | null;
      clienteCodigo = pessoa?.codigo ? String(pessoa.codigo) : '';
    } catch (e) {
      console.error('[ROUTE-LEAD] pessoa:', (e as Error).message);
    }

    const telTail = erpPhone.slice(-8);
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 180 * 86400000);

    let pedidos: Row[] = [];
    try {
      const feed = normalizePaged(
        await gpCall(creds, 'GET', '/erpssplus/v3/pedido/feed', {
          bloco: 1,
          tipopedido: PEDIDO_TIPOS,
          dtinicio: inicio.toISOString().slice(0, 10),
          dtfinal: hoje.toISOString().slice(0, 10),
        }),
        ['pedidos'],
      );
      pedidos = feed.items as Row[];
    } catch (e) {
      console.error('[ROUTE-LEAD] feed:', (e as Error).message);
      return json({ ok: false, reason: 'ERP indisponível' });
    }

    const doCliente = pedidos.filter((p) => {
      if (clienteCodigo && onlyDigits(p.codpessoa) === onlyDigits(clienteCodigo)) return true;
      const fones = p.fones && typeof p.fones === 'object'
        ? Object.values(p.fones as Row).map((v) => onlyDigits(v)).filter((v) => v.length >= 8)
        : [];
      return fones.some((f) => f.slice(-8) === telTail);
    });

    const emAberto = doCliente.filter((p) => {
      const situacao = String(p.situacao ?? p.status ?? p.dessituacao ?? '').toUpperCase();
      return !OPEN_STATUS_BLOCK.some((s) => situacao.includes(s));
    });

    const candidatos = (emAberto.length ? emAberto : doCliente).sort((a, b) =>
      String(b.dtemissao ?? b.data ?? '').localeCompare(String(a.dtemissao ?? a.data ?? '')));

    for (const pedido of candidatos) {
      const vendedor = vendedorNome(pedido);
      if (!vendedor) continue;
      const userId = await resolveVendedorUser(admin, vendedor);
      if (!userId) continue;

      await admin.from('conversations').update({ assigned_to: userId }).eq('id', conversationId);
      console.log('[ROUTE-LEAD] conversa', conversationId, 'atribuída a', userId, 'via vendedor', vendedor);
      return json({ ok: true, assigned_to: userId, vendedor });
    }

    return json({ ok: true, reason: 'sem vendedor mapeado' });
  } catch (e) {
    console.error('[ROUTE-LEAD] erro:', (e as Error).message);
    return json({ ok: false, error: (e as Error).message });
  }
});
