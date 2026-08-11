// Shared types for the multi-agent ("Equipe Digital de IA") runtime.

export interface AgentConfig {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_name: string;
  role_key: string | null;
  objective: string | null;
  not_allowed: string | null;
  personality_prompt: string | null;
  behavior_rules: string | null;
  greeting_message: string | null;
  fallback_message: string | null;
  is_active: boolean | null;
  is_orchestrator: boolean;
  activation_rules: Record<string, unknown>;
  allowed_tools: string[];
  max_delegations: number;
  max_tool_calls: number;
}

export interface AgentContext {
  organizationId: string;
  memberIds: string[];
  conversationId: string | null;
  contactId: string | null;
  userId: string | null;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDefinition {
  key: string;
  /** User-facing label, business language (no AI jargon). */
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  /** true = only reads data. */
  readOnly: boolean;
  execute: (
    args: Record<string, any>,
    ctx: AgentContext,
    supabase: any,
  ) => Promise<ToolResult>;
}

export type StepType =
  | 'intent'
  | 'agent'
  | 'knowledge'
  | 'memory'
  | 'tool'
  | 'delegation'
  | 'transfer'
  | 'compose';
