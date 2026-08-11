// AI Orchestrator: picks the right agent for the incoming message, runs it,
// applies transfer rules and consolidates a single answer for the customer.

import { runAgent } from './agent-runtime.ts';
import { TOOL_MAP } from './tool-registry.ts';
import type { AgentConfig, AgentContext } from './types.ts';
import type { RunLogger } from './run-logger.ts';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const ROUTER_MODEL = 'google/gemini-2.5-flash-lite';

export interface OrchestrationResult {
  response: string;
  intent: string | null;
  agentId: string | null;
  agentName: string | null;
  tokens: number;
  handoff: boolean;
}

async function classify(
  apiKey: string,
  message: string,
  agents: AgentConfig[],
): Promise<{ intent: string; agentId: string | null }> {
  const roster = agents
    .map((a) => `- id: ${a.id} | nome: ${a.agent_name} | função: ${a.role_key ?? '-'} | objetivo: ${(a.objective ?? '').slice(0, 200)}`)
    .join('\n');

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Você direciona mensagens de clientes para o colaborador digital certo.\n' +
            'Responda APENAS com um JSON: {"intent":"resumo curto da intenção","agent_id":"id escolhido"}.\n' +
            'Escolha o agente mais adequado da lista. Se nenhum servir, use o primeiro da lista.\n\n' +
            `Agentes disponíveis:\n${roster}`,
        },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok) return { intent: 'indefinida', agentId: agents[0]?.id ?? null };
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const found = agents.find((a) => a.id === parsed.agent_id);
    return { intent: String(parsed.intent ?? 'indefinida'), agentId: found?.id ?? agents[0]?.id ?? null };
  } catch {
    return { intent: 'indefinida', agentId: agents[0]?.id ?? null };
  }
}

export async function orchestrate(params: {
  supabase: any;
  apiKey: string;
  ctx: AgentContext;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  logger: RunLogger;
}): Promise<OrchestrationResult> {
  const { supabase, apiKey, ctx, message, logger } = params;

  const { data: rows, error } = await supabase
    .from('ai_agent_configs')
    .select('*')
    .eq('organization_id', ctx.organizationId)
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  const agents = (rows ?? []) as AgentConfig[];
  if (!agents.length) throw new Error('Nenhum agente ativo configurado para esta empresa.');

  const orchestratorAgent = agents.find((a) => a.is_orchestrator) ?? null;
  const specialists = agents.filter((a) => !a.is_orchestrator);
  const pool = specialists.length ? specialists : agents;

  // 1) Intent + agent selection
  const t0 = Date.now();
  const { intent, agentId } = pool.length === 1
    ? { intent: 'única opção', agentId: pool[0].id }
    : await classify(apiKey, message, pool);

  await logger.step({
    type: 'intent',
    label: 'Intenção identificada',
    agentConfigId: orchestratorAgent?.id ?? null,
    input: message,
    output: { intent, agent_id: agentId },
    durationMs: Date.now() - t0,
  });

  let agent = pool.find((a) => a.id === agentId) ?? pool[0];
  let tokens = 0;
  let handoff = false;
  let text = '';

  const maxDelegations = agent.max_delegations ?? 2;
  const visited = new Set<string>();

  for (let hop = 0; hop <= maxDelegations; hop++) {
    if (visited.has(agent.id)) break;
    visited.add(agent.id);

    const ts = Date.now();
    const result = await runAgent({
      supabase,
      apiKey,
      agent,
      ctx,
      message,
      history: params.history,
      logger,
    });
    tokens += result.tokens;
    text = result.text || text;
    handoff = handoff || result.handoff;

    await logger.step({
      type: 'agent',
      label: agent.agent_name,
      agentConfigId: agent.id,
      output: text.slice(0, 500),
      durationMs: Date.now() - ts,
    });

    if (handoff || !text) break;

    // 2) Transfer rules — should another agent take over?
    const { data: transfers } = await supabase
      .from('ai_agent_transfers')
      .select('to_agent_id, condition_text, priority')
      .eq('from_agent_id', agent.id)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    const candidates = (transfers ?? []).filter((t: any) => !visited.has(t.to_agent_id));
    if (!candidates.length) break;

    const next = await shouldTransfer(apiKey, message, text, candidates, agents);
    if (!next) break;

    const target = agents.find((a) => a.id === next);
    if (!target) break;

    await logger.step({
      type: 'transfer',
      label: `Transferido para ${target.agent_name}`,
      agentConfigId: agent.id,
      output: { to: target.agent_name },
    });
    agent = target;
  }

  await logger.step({ type: 'compose', label: 'Resposta consolidada', output: text.slice(0, 500) });

  return {
    response: text,
    intent,
    agentId: agent.id,
    agentName: agent.agent_name,
    tokens,
    handoff,
  };
}

async function shouldTransfer(
  apiKey: string,
  message: string,
  draft: string,
  candidates: { to_agent_id: string; condition_text: string | null }[],
  agents: AgentConfig[],
): Promise<string | null> {
  const list = candidates
    .map((c) => {
      const a = agents.find((x) => x.id === c.to_agent_id);
      return `- id: ${c.to_agent_id} | ${a?.agent_name ?? '?'} | condição: ${c.condition_text ?? 'não informada'}`;
    })
    .join('\n');

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'Decida se o atendimento deve ser transferido para outro colaborador digital.\n' +
            'Responda APENAS {"transferir":false} ou {"transferir":true,"agent_id":"..."}.\n' +
            'Só transfira quando a condição do destino for claramente atendida e a resposta atual estiver incompleta.\n\n' +
            `Destinos possíveis:\n${list}`,
        },
        { role: 'user', content: `Mensagem do cliente: ${message}\n\nResposta preparada: ${draft}` },
      ],
    }),
  });
  if (!res.ok) return null;
  try {
    const json = await res.json();
    const parsed = JSON.parse((json.choices?.[0]?.message?.content ?? '').replace(/```json|```/g, '').trim());
    return parsed.transferir ? String(parsed.agent_id) : null;
  } catch {
    return null;
  }
}

export const AVAILABLE_TOOL_KEYS = Array.from(TOOL_MAP.keys());
