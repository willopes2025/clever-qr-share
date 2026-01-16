import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Link2, Unlink, Check, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface AgentSelectorProps {
  funnelId: string;
  currentAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
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
  onUnlink,
}: AgentSelectorProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Filter: show agents that are not linked to any funnel/campaign, or are linked to current funnel
  const availableAgents = agents.filter(
    (agent) => (!agent.funnel_id && !agent.campaign_id) || agent.funnel_id === funnelId
  );

  // Agents linked to other funnels or campaigns (show as unavailable)
  const linkedElsewhere = agents.filter(
    (agent) => (agent.funnel_id && agent.funnel_id !== funnelId) || agent.campaign_id
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

        {/* Agents linked elsewhere */}
        {linkedElsewhere.length > 0 && (
          <>
            <div className="text-xs text-muted-foreground mt-2">
              Em uso por outros funis/campanhas:
            </div>
            {linkedElsewhere.map((agent) => (
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
                    {agent.funnel_id ? 'Vinculado a outro funil' : 'Vinculado a uma campanha'}
                  </p>
                </div>
              </Card>
            ))}
          </>
        )}

        {/* Empty state with link to create agents */}
        {availableAgents.length === 0 && linkedElsewhere.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground/50" />
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
        )}

        {/* Link to manage agents */}
        {(availableAgents.length > 0 || linkedElsewhere.length > 0) && (
          <div className="pt-2 mt-2 border-t">
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
        )}
      </div>
    </div>
  );
};
