import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface AgentPickerProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  excludeAgentIds?: string[];
  disabled?: boolean;
  showLinkedInfo?: boolean;
}

interface AgentOption {
  id: string;
  agent_name: string;
  is_active: boolean;
  template_type: string | null;
  funnel_id: string | null;
  campaign_id: string | null;
}

export const AgentPicker = ({
  selectedAgentId,
  onSelectAgent,
  excludeAgentIds = [],
  disabled = false,
  showLinkedInfo = true,
}: AgentPickerProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['available-agents-picker', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('ai_agent_configs')
        .select('id, agent_name, is_active, template_type, funnel_id, campaign_id')
        .eq('user_id', user.id)
        .order('agent_name', { ascending: true });

      if (error) throw error;
      return data as AgentOption[];
    },
    enabled: !!user,
  });

  // Filter available agents (not linked to funnel/campaign or is the currently selected one)
  const availableAgents = agents.filter(
    (agent) => 
      (!agent.funnel_id && !agent.campaign_id) || 
      agent.id === selectedAgentId
  );

  // Filter excluded agents
  const filteredAgents = availableAgents.filter(
    (agent) => !excludeAgentIds.includes(agent.id)
  );

  // Agents that are linked elsewhere
  const linkedAgents = agents.filter(
    (agent) => 
      (agent.funnel_id || agent.campaign_id) && 
      agent.id !== selectedAgentId &&
      !excludeAgentIds.includes(agent.id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filteredAgents.length === 0 && linkedAgents.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Nenhum agente disponível
          </p>
          <p className="text-xs text-muted-foreground">
            Crie um agente na seção Agentes de IA
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/ai-agents')}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Ir para Agentes de IA
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Available agents */}
      <div className="grid gap-2">
        {filteredAgents.map((agent) => {
          const isSelected = selectedAgentId === agent.id;

          return (
            <Card
              key={agent.id}
              className={cn(
                'p-3 transition-all flex items-center gap-3',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                isSelected && 'ring-2 ring-primary bg-primary/5',
                !isSelected && !disabled && 'hover:border-primary/50'
              )}
              onClick={() => !disabled && onSelectAgent(isSelected ? null : agent.id)}
            >
              <div className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                agent.is_active ? 'bg-emerald-500/10' : 'bg-muted'
              )}>
                <Bot className={cn(
                  'h-4 w-4',
                  agent.is_active ? 'text-emerald-500' : 'text-muted-foreground'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate text-sm">{agent.agent_name}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {agent.template_type && (
                    <span className="capitalize">{agent.template_type.replace('_', ' ')}</span>
                  )}
                  {agent.is_active ? (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600/30 px-1.5 py-0">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Linked agents info */}
      {showLinkedInfo && linkedAgents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Em uso ({linkedAgents.length}):
          </p>
          <div className="grid gap-1.5">
            {linkedAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg opacity-60"
              >
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs truncate">{agent.agent_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {agent.funnel_id ? 'Funil' : 'Campanha'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to create new */}
      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/ai-agents')}
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          Gerenciar agentes
        </Button>
      </div>
    </div>
  );
};
