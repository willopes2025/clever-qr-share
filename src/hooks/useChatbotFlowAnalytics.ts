import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NodeAnalytics {
  node_id: string;
  node_type: string;
  total_reached: number;
  total_responded: number;
  reach_rate: number;
  response_rate: number;
}

export interface FlowAnalytics {
  total_executions: number;
  nodes: NodeAnalytics[];
}

export const useChatbotFlowAnalytics = (flowId: string, days: number = 30) => {
  return useQuery({
    queryKey: ['chatbot-flow-analytics', flowId, days],
    queryFn: async (): Promise<FlowAnalytics> => {
      const since = new Date(Date.now() - days * 86400000).toISOString();

      // Get total unique executions for this flow in the period
      const { data: executions } = await supabase
        .from('chatbot_executions')
        .select('id')
        .eq('flow_id', flowId)
        .gte('started_at', since);

      const totalExecutions = executions?.length || 0;

      // Get node execution data
      const { data: nodeExecs } = await supabase
        .from('chatbot_node_executions' as any)
        .select('node_id, node_type, status')
        .eq('flow_id', flowId)
        .gte('created_at', since);

      if (!nodeExecs || nodeExecs.length === 0) {
        return { total_executions: totalExecutions, nodes: [] };
      }

      // Aggregate by node_id
      const nodeMap = new Map<string, { node_type: string; reached: number; responded: number }>();

      for (const exec of nodeExecs) {
        const existing = nodeMap.get(exec.node_id) || { node_type: exec.node_type, reached: 0, responded: 0 };
        existing.reached++;
        if (exec.status === 'responded') {
          existing.responded++;
        }
        nodeMap.set(exec.node_id, existing);
      }

      // For waiting_input nodes, count unique execution_ids as "reached" and "responded" separately
      // Re-aggregate properly: reached = total entries (waiting_input + responded + processed), responded = only responded
      const nodeMapClean = new Map<string, { node_type: string; reached: Set<string>; responded: Set<string> }>();

      for (const exec of nodeExecs as any[]) {
        if (!nodeMapClean.has(exec.node_id)) {
          nodeMapClean.set(exec.node_id, { node_type: exec.node_type, reached: new Set(), responded: new Set() });
        }
        const entry = nodeMapClean.get(exec.node_id)!;
        // Each record represents one execution reaching this node
        // We don't have execution_id in the select, so count records as proxy
        entry.reached.add(`${exec.node_id}-${entry.reached.size}`);
        if (exec.status === 'responded') {
          entry.responded.add(`${exec.node_id}-${entry.responded.size}`);
        }
      }

      const nodes: NodeAnalytics[] = [];
      for (const [nodeId, data] of nodeMap.entries()) {
        const reachRate = totalExecutions > 0 ? (data.reached / totalExecutions) * 100 : 0;
        const responseRate = data.reached > 0 ? (data.responded / data.reached) * 100 : 0;
        nodes.push({
          node_id: nodeId,
          node_type: data.node_type,
          total_reached: data.reached,
          total_responded: data.responded,
          reach_rate: Math.round(reachRate * 10) / 10,
          response_rate: Math.round(responseRate * 10) / 10,
        });
      }

      return { total_executions: totalExecutions, nodes };
    },
    enabled: !!flowId,
  });
};
