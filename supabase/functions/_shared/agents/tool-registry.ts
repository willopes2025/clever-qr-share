// Central catalog of tools an AI agent may execute.
// Permissions are ALWAYS validated here (server-side) against the agent's
// `allowed_tools`. The UI is only a convenience.

import type { AgentConfig, AgentContext, ToolDefinition, ToolResult } from './types.ts';

const ok = (data: unknown): ToolResult => ({ ok: true, data });
const fail = (error: string): ToolResult => ({ ok: false, error });

function scoped(query: any, ctx: AgentContext) {
  return query.in('user_id', ctx.memberIds);
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    key: 'consultar_cliente',
    label: 'Consultar cliente',
    description: 'Busca os dados cadastrais de um cliente pelo nome, telefone ou pelo contato atual.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Nome ou telefone. Vazio usa o contato da conversa.' },
      },
    },
    execute: async (args, ctx, supabase) => {
      let q = scoped(
        supabase.from('contacts').select('id, name, phone, email, custom_fields, contact_display_id, status'),
        ctx,
      ).limit(5);
      if (args.termo) {
        q = q.or(`name.ilike.%${args.termo}%,phone.ilike.%${args.termo}%`);
      } else if (ctx.contactId) {
        q = q.eq('id', ctx.contactId);
      } else {
        return fail('Nenhum cliente informado.');
      }
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok(data ?? []);
    },
  },
  {
    key: 'consultar_crm',
    label: 'Consultar CRM (oportunidades)',
    description: 'Lista as oportunidades/negócios do cliente com etapa e valor.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { contact_id: { type: 'string', description: 'Opcional; padrão é o contato da conversa.' } },
    },
    execute: async (args, ctx, supabase) => {
      const contactId = args.contact_id || ctx.contactId;
      if (!contactId) return fail('Contato não identificado.');
      const { data, error } = await scoped(
        supabase
          .from('funnel_deals')
          .select('id, title, value, notes, expected_close_date, custom_fields, stage:funnel_stages(name)'),
        ctx,
      )
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return fail(error.message);
      return ok(data ?? []);
    },
  },
  {
    key: 'atualizar_lead',
    label: 'Atualizar lead',
    description: 'Atualiza informações da oportunidade do cliente (observações, valor ou campos personalizados).',
    readOnly: false,
    parameters: {
      type: 'object',
      properties: {
        deal_id: { type: 'string' },
        notes: { type: 'string' },
        value: { type: 'number' },
        custom_fields: { type: 'object' },
      },
      required: ['deal_id'],
    },
    execute: async (args, ctx, supabase) => {
      const patch: Record<string, unknown> = {};
      if (args.notes !== undefined) patch.notes = args.notes;
      if (args.value !== undefined) patch.value = args.value;
      if (args.custom_fields !== undefined) patch.custom_fields = args.custom_fields;
      if (!Object.keys(patch).length) return fail('Nada para atualizar.');
      const { error } = await scoped(supabase.from('funnel_deals').update(patch), ctx).eq('id', args.deal_id);
      if (error) return fail(error.message);
      return ok({ updated: true });
    },
  },
  {
    key: 'criar_oportunidade',
    label: 'Criar oportunidade',
    description: 'Cria uma nova oportunidade para o cliente em um funil/etapa.',
    readOnly: false,
    parameters: {
      type: 'object',
      properties: {
        funnel_id: { type: 'string' },
        stage_id: { type: 'string' },
        title: { type: 'string' },
        value: { type: 'number' },
      },
      required: ['funnel_id', 'stage_id'],
    },
    execute: async (args, ctx, supabase) => {
      if (!ctx.contactId) return fail('Contato não identificado.');
      const { data: stage } = await supabase
        .from('funnel_stages')
        .select('id, funnel_id')
        .eq('id', args.stage_id)
        .maybeSingle();
      if (!stage || stage.funnel_id !== args.funnel_id) return fail('Etapa inválida para o funil informado.');
      const { data, error } = await supabase
        .from('funnel_deals')
        .insert({
          user_id: ctx.userId ?? ctx.memberIds[0],
          contact_id: ctx.contactId,
          conversation_id: ctx.conversationId,
          funnel_id: args.funnel_id,
          stage_id: args.stage_id,
          title: args.title ?? null,
          value: args.value ?? null,
          source: 'ai_agent',
        })
        .select('id')
        .single();
      if (error) return fail(error.message);
      return ok(data);
    },
  },
  {
    key: 'consultar_financeiro',
    label: 'Consultar financeiro',
    description: 'Consulta cobranças e faturas do cliente (valor, vencimento, situação e link).',
    readOnly: true,
    parameters: { type: 'object', properties: {} },
    execute: async (_args, ctx, supabase) => {
      if (!ctx.contactId) return fail('Contato não identificado.');
      const { data, error } = await scoped(
        supabase
          .from('billing_reminders')
          .select('value, due_date, status, invoice_url, bank_slip_url, billing_type, reminder_type'),
        ctx,
      )
        .eq('contact_id', ctx.contactId)
        .order('due_date', { ascending: false })
        .limit(10);
      if (error) return fail(error.message);
      return ok(data ?? []);
    },
  },
  {
    key: 'criar_tarefa',
    label: 'Criar tarefa',
    description: 'Cria uma tarefa interna para a equipe humana dar sequência ao atendimento.',
    readOnly: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        due_date: { type: 'string', description: 'AAAA-MM-DD' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['title'],
    },
    execute: async (args, ctx, supabase) => {
      const { data, error } = await supabase
        .from('conversation_tasks')
        .insert({
          user_id: ctx.userId ?? ctx.memberIds[0],
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
          title: args.title,
          description: args.description ?? null,
          due_date: args.due_date ?? null,
          priority: args.priority ?? 'medium',
        })
        .select('id')
        .single();
      if (error) return fail(error.message);
      return ok(data);
    },
  },
  {
    key: 'consultar_conhecimento',
    label: 'Consultar conhecimento (produtos, serviços, FAQ)',
    description: 'Procura informações nas fontes de conhecimento liberadas para este agente.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { termo: { type: 'string' } },
      required: ['termo'],
    },
    execute: async (args, ctx, supabase) => {
      const { data, error } = await scoped(
        supabase.from('ai_agent_knowledge_items').select('title, content, processed_content'),
        ctx,
      )
        .eq('status', 'completed')
        .or(`title.ilike.%${args.termo}%,content.ilike.%${args.termo}%`)
        .limit(4);
      if (error) return fail(error.message);
      return ok(
        (data ?? []).map((k: any) => ({
          title: k.title,
          content: (k.processed_content || k.content || '').slice(0, 1500),
        })),
      );
    },
  },
  {
    key: 'transferir_atendimento',
    label: 'Transferir atendimento',
    description: 'Transfere a conversa para um atendente humano quando o agente não pode resolver.',
    readOnly: false,
    parameters: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: ['motivo'],
    },
    execute: async (args, ctx, supabase) => {
      if (!ctx.conversationId) return fail('Conversa não identificada.');
      const { error } = await supabase
        .from('conversations')
        .update({ ai_handoff_requested: true, ai_handoff_reason: args.motivo, ai_paused: true })
        .eq('id', ctx.conversationId);
      if (error) return fail(error.message);
      return ok({ transferido: true });
    },
  },
];

export const TOOL_MAP = new Map(TOOL_REGISTRY.map((t) => [t.key, t]));

/** Tools this agent is explicitly allowed to run, as OpenAI-compatible schemas. */
export function toolSchemasForAgent(agent: AgentConfig) {
  return (agent.allowed_tools ?? [])
    .map((key) => TOOL_MAP.get(key))
    .filter((t): t is ToolDefinition => !!t)
    .map((t) => ({
      type: 'function',
      function: { name: t.key, description: t.description, parameters: t.parameters },
    }));
}

/** Server-side permission gate + execution. */
export async function runTool(
  agent: AgentConfig,
  key: string,
  args: Record<string, any>,
  ctx: AgentContext,
  supabase: any,
): Promise<ToolResult> {
  if (!(agent.allowed_tools ?? []).includes(key)) {
    return { ok: false, error: `Ferramenta "${key}" não autorizada para este agente.` };
  }
  const tool = TOOL_MAP.get(key);
  if (!tool) return { ok: false, error: `Ferramenta desconhecida: ${key}` };
  try {
    return await tool.execute(args ?? {}, ctx, supabase);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro na ferramenta' };
  }
}
