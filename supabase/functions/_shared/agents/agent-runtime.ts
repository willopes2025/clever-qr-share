// Agent Runtime: builds the prompt for a single agent, calls the model through
// Lovable AI Gateway, executes its permitted tools and returns the answer.

import { runTool, toolSchemasForAgent } from './tool-registry.ts';
import { recallMemory, renderMemoryBlock } from './memory.ts';
import type { AgentConfig, AgentContext } from './types.ts';
import type { RunLogger } from './run-logger.ts';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

export interface RuntimeResult {
  text: string;
  toolCalls: string[];
  tokens: number;
  handoff: boolean;
}

async function loadKnowledge(supabase: any, agent: AgentConfig, message: string): Promise<string> {
  const { data: links } = await supabase
    .from('ai_agent_knowledge_links')
    .select('knowledge_item_id')
    .eq('agent_config_id', agent.id);

  const ids = (links ?? []).map((l: any) => l.knowledge_item_id);

  let query = supabase
    .from('ai_agent_knowledge_items')
    .select('title, content, processed_content')
    .eq('status', 'completed')
    .limit(6);

  query = ids.length
    ? query.or(`agent_config_id.eq.${agent.id},id.in.(${ids.join(',')})`)
    : query.eq('agent_config_id', agent.id);

  const { data } = await query;
  if (!data?.length) return '';

  const words = message.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const ranked = data
    .map((k: any) => {
      const body = (k.processed_content || k.content || '').slice(0, 3000);
      const hay = `${k.title} ${body}`.toLowerCase();
      return { k, body, score: words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0) };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);

  return '\n\n## Conhecimento disponível\n' + ranked.map((r: any) => `### ${r.k.title}\n${r.body}`).join('\n\n');
}

export function buildSystemPrompt(agent: AgentConfig, extras: string): string {
  const parts = [
    `Você é ${agent.agent_name}${agent.role_key ? `, responsável por ${agent.role_key.replace(/_/g, ' ')}` : ''} da empresa.`,
  ];
  if (agent.objective) parts.push(`## Objetivo\n${agent.objective}`);
  if (agent.personality_prompt) parts.push(`## Personalidade e tom\n${agent.personality_prompt}`);
  if (agent.behavior_rules) parts.push(`## Regras de comportamento\n${agent.behavior_rules}`);
  if (agent.not_allowed) parts.push(`## O que você NÃO deve fazer\n${agent.not_allowed}`);
  parts.push(
    '## Regras gerais\n' +
      '- Responda sempre em português do Brasil, de forma natural e objetiva.\n' +
      '- Use apenas informações reais obtidas do conhecimento, da memória ou das ferramentas. Nunca invente dados.\n' +
      '- Se não puder resolver, use a ferramenta de transferência de atendimento (quando disponível).\n' +
      '- O cliente não deve perceber que existem vários agentes internos.',
  );
  return parts.join('\n\n') + extras;
}

export async function runAgent(params: {
  supabase: any;
  apiKey: string;
  agent: AgentConfig;
  ctx: AgentContext;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  logger?: RunLogger;
  extraSystem?: string;
}): Promise<RuntimeResult> {
  const { supabase, apiKey, agent, ctx, message, logger } = params;

  const t0 = Date.now();
  const memory = await recallMemory(supabase, ctx, message);
  await logger?.step({
    type: 'memory',
    label: 'Memória recuperada',
    agentConfigId: agent.id,
    output: memory.map((m) => m.memory_key),
    durationMs: Date.now() - t0,
  });

  const t1 = Date.now();
  const knowledge = await loadKnowledge(supabase, agent, message);
  await logger?.step({
    type: 'knowledge',
    label: 'Conhecimento consultado',
    agentConfigId: agent.id,
    output: knowledge ? `${knowledge.length} caracteres` : 'nenhum',
    durationMs: Date.now() - t1,
  });

  const system =
    buildSystemPrompt(agent, renderMemoryBlock(memory) + knowledge) +
    (params.extraSystem ? `\n\n${params.extraSystem}` : '');

  const messages: any[] = [
    { role: 'system', content: system },
    ...(params.history ?? []),
    { role: 'user', content: message },
  ];

  const tools = toolSchemasForAgent(agent);
  const executed: string[] = [];
  let tokens = 0;
  let handoff = false;
  const maxToolCalls = agent.max_tool_calls ?? 8;

  for (let loop = 0; loop < 6; loop++) {
    const body: any = { model: MODEL, messages, temperature: 0.6 };
    if (tools.length && executed.length < maxToolCalls) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error('Limite de uso da IA atingido. Tente novamente em instantes.');
    if (res.status === 402) throw new Error('Créditos de IA esgotados. Adicione créditos para continuar.');
    if (!res.ok) throw new Error(`Falha na IA (${res.status}): ${(await res.text()).slice(0, 300)}`);

    const json = await res.json();
    tokens += json.usage?.total_tokens ?? 0;
    const choice = json.choices?.[0]?.message;
    const calls = choice?.tool_calls ?? [];

    if (!calls.length) {
      return { text: (choice?.content ?? '').trim(), toolCalls: executed, tokens, handoff };
    }

    messages.push(choice);
    for (const call of calls) {
      const name = call.function?.name;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.function?.arguments || '{}');
      } catch { /* ignore */ }

      const ts = Date.now();
      const result = await runTool(agent, name, args, ctx, supabase);
      executed.push(name);
      if (name === 'transferir_atendimento' && result.ok) handoff = true;

      await logger?.step({
        type: 'tool',
        label: name,
        agentConfigId: agent.id,
        input: args,
        output: result.ok ? result.data : result.error,
        status: result.ok ? 'ok' : 'error',
        error: result.ok ? null : result.error,
        durationMs: Date.now() - ts,
      });

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.ok ? result.data : { erro: result.error }),
      });
    }
  }

  return { text: agent.fallback_message ?? '', toolCalls: executed, tokens, handoff };
}
