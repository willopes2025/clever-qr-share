import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Link2, Unlink, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentSelectorProps {
  funnelId: string;
  currentAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateNew: () => void;
  onUnlink: () => void;
}

interface AgentOption {
  id: string;
  agent_name: string;
  is_active: boolean;
  template_type: string | null;
  funnel_id: string | null;
  campaign_id: string | null;
}

export const AgentSelector = ({
  funnelId,
  currentAgentId,
  onSelectAgent,
  onCreateNew,
  onUnlink,
}: AgentSelectorProps) => {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(currentAgentId);

  // Fetch all agents (available and current)
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['available-agents', user?.id, funnelId],
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

  // Filter: show agents that are not linked to any funnel, or are linked to current funnel
  const availableAgents = agents.filter(
    (agent) => !agent.funnel_id || agent.funnel_id === funnelId
  );

  // Agents linked to other funnels (show as unavailable)
  const linkedToOtherFunnels = agents.filter(
    (agent) => agent.funnel_id && agent.funnel_id !== funnelId
  );

  const handleSelect = (agentId: string) => {
    setSelectedId(agentId);
    onSelectAgent(agentId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Selecione um agente de IA para este funil
        </h3>
        {currentAgentId && (
          <Button variant="ghost" size="sm" onClick={onUnlink} className="text-muted-foreground">
            <Unlink className="h-4 w-4 mr-1" />
            Desvincular
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        {/* Create new agent option */}
        <Card
          className={cn(
            'p-3 cursor-pointer transition-all border-dashed hover:border-primary hover:bg-primary/5',
            'flex items-center gap-3'
          )}
          onClick={onCreateNew}
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Criar novo agente</p>
            <p className="text-xs text-muted-foreground">
              Crie um agente exclusivo para este funil
            </p>
          </div>
        </Card>

        {/* Available agents */}
        {availableAgents.map((agent) => {
          const isSelected = selectedId === agent.id;
          const isLinkedHere = agent.funnel_id === funnelId;

          return (
            <Card
              key={agent.id}
              className={cn(
                'p-3 cursor-pointer transition-all',
                'flex items-center gap-3',
                isSelected && 'ring-2 ring-primary bg-primary/5',
                !isSelected && 'hover:border-primary/50'
              )}
              onClick={() => handleSelect(agent.id)}
            >
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                agent.is_active ? 'bg-emerald-500/10' : 'bg-muted'
              )}>
                <Bot className={cn(
                  'h-5 w-5',
                  agent.is_active ? 'text-emerald-500' : 'text-muted-foreground'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{agent.agent_name}</p>
                  {isLinkedHere && (
                    <Badge variant="secondary" className="text-xs">
                      <Link2 className="h-3 w-3 mr-1" />
                      Vinculado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {agent.template_type && (
                    <span className="capitalize">{agent.template_type.replace('_', ' ')}</span>
                  )}
                  {agent.is_active ? (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600/30">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </Card>
          );
        })}

        {/* Agents linked to other funnels */}
        {linkedToOtherFunnels.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground mt-2">
              Em uso por outros funis:
            </div>
            {linkedToOtherFunnels.map((agent) => (
              <Card
                key={agent.id}
                className="p-3 flex items-center gap-3 opacity-50 cursor-not-allowed"
              >
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{agent.agent_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vinculado a outro funil
                  </p>
                </div>
              </Card>
            ))}
          </>
        )}

        {availableAgents.length === 0 && linkedToOtherFunnels.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum agente encontrado. Crie um novo agente acima.
          </p>
        )}
      </div>
    </div>
  );
};
