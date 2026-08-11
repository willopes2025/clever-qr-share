// Execution logging for observability / auditing.

import type { StepType } from './types.ts';

export class RunLogger {
  private index = 0;
  runId: string | null = null;
  private started = Date.now();

  constructor(private supabase: any, private organizationId: string) {}

  async start(params: {
    conversationId?: string | null;
    contactId?: string | null;
    entryAgentId?: string | null;
    incomingMessage?: string | null;
  }) {
    const { data } = await this.supabase
      .from('ai_execution_runs')
      .insert({
        organization_id: this.organizationId,
        conversation_id: params.conversationId ?? null,
        contact_id: params.contactId ?? null,
        entry_agent_id: params.entryAgentId ?? null,
        incoming_message: params.incomingMessage?.slice(0, 4000) ?? null,
        status: 'running',
      })
      .select('id')
      .single();
    this.runId = data?.id ?? null;
    return this.runId;
  }

  async step(params: {
    type: StepType;
    label?: string;
    agentConfigId?: string | null;
    input?: unknown;
    output?: unknown;
    durationMs?: number;
    status?: 'ok' | 'error';
    error?: string | null;
  }) {
    if (!this.runId) return;
    const summarize = (v: unknown) =>
      v === undefined || v === null ? null : (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 4000);
    await this.supabase.from('ai_execution_steps').insert({
      run_id: this.runId,
      organization_id: this.organizationId,
      step_index: this.index++,
      step_type: params.type,
      label: params.label ?? null,
      agent_config_id: params.agentConfigId ?? null,
      input_summary: summarize(params.input),
      output_summary: summarize(params.output),
      duration_ms: params.durationMs ?? null,
      status: params.status ?? 'ok',
      error_message: params.error ?? null,
    });
  }

  async finish(params: {
    status: 'completed' | 'failed';
    finalAgentId?: string | null;
    intent?: string | null;
    response?: string | null;
    totalTokens?: number | null;
    error?: string | null;
  }) {
    if (!this.runId) return;
    await this.supabase
      .from('ai_execution_runs')
      .update({
        status: params.status,
        final_agent_id: params.finalAgentId ?? null,
        detected_intent: params.intent ?? null,
        final_response: params.response?.slice(0, 8000) ?? null,
        total_tokens: params.totalTokens ?? null,
        error_message: params.error ?? null,
        duration_ms: Date.now() - this.started,
      })
      .eq('id', this.runId);
  }
}
