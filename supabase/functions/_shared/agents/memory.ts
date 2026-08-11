// Memory service: conversation / contact / organization layers.
// Only relevant snippets are returned so we never dump the whole memory
// into the model context.

import type { AgentContext } from './types.ts';

export interface MemoryRecord {
  scope: 'conversation' | 'contact' | 'organization';
  memory_key: string;
  content: string;
  importance: number;
}

const STOPWORDS = new Set([
  'para','como','isso','esse','essa','você','voce','tem','com','que','uma','dos','das','por','mais','sobre','qual','quais','meu','minha','the','and',
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 12);
}

function score(record: any, words: string[]): number {
  const hay = `${record.memory_key} ${record.content}`.toLowerCase();
  let s = (record.importance ?? 1) * 0.5;
  for (const w of words) if (hay.includes(w)) s += 2;
  return s;
}

/** Fetch the memory that is closest to the current message (keywords + importance + recency). */
export async function recallMemory(
  supabase: any,
  ctx: AgentContext,
  message: string,
  limit = 8,
): Promise<MemoryRecord[]> {
  const filters: string[] = ['scope.eq.organization'];
  if (ctx.conversationId) filters.push(`and(scope.eq.conversation,conversation_id.eq.${ctx.conversationId})`);
  if (ctx.contactId) filters.push(`and(scope.eq.contact,contact_id.eq.${ctx.contactId})`);

  const { data, error } = await supabase
    .from('ai_agent_memory')
    .select('scope, memory_key, content, importance, expires_at, created_at')
    .eq('organization_id', ctx.organizationId)
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(60);

  if (error || !data) return [];
  const now = Date.now();
  const words = keywords(message);
  return data
    .filter((r: any) => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .map((r: any) => ({ r, s: score(r, words) }))
    .sort((a: any, b: any) => b.s - a.s)
    .slice(0, limit)
    .map(({ r }: any) => ({
      scope: r.scope,
      memory_key: r.memory_key,
      content: r.content,
      importance: r.importance,
    }));
}

export async function rememberMemory(
  supabase: any,
  ctx: AgentContext,
  record: MemoryRecord & { agentConfigId?: string | null },
) {
  await supabase.from('ai_agent_memory').insert({
    organization_id: ctx.organizationId,
    scope: record.scope,
    conversation_id: record.scope === 'conversation' ? ctx.conversationId : null,
    contact_id: record.scope === 'contact' ? ctx.contactId : null,
    agent_config_id: record.agentConfigId ?? null,
    memory_key: record.memory_key,
    content: record.content,
    importance: record.importance ?? 1,
  });
}

export function renderMemoryBlock(records: MemoryRecord[]): string {
  if (!records.length) return '';
  const labels: Record<string, string> = {
    conversation: 'Conversa atual',
    contact: 'Sobre o cliente',
    organization: 'Regras da empresa',
  };
  return (
    '\n\n## Memória relevante\n' +
    records.map((r) => `- [${labels[r.scope] ?? r.scope}] ${r.memory_key}: ${r.content}`).join('\n')
  );
}
