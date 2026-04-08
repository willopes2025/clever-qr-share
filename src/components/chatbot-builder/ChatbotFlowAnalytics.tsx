import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useChatbotFlowAnalytics } from '@/hooks/useChatbotFlowAnalytics';
import { Loader2, TrendingUp, Users, MessageSquare } from 'lucide-react';
import { Node } from '@xyflow/react';

const nodeTypeLabels: Record<string, string> = {
  start: 'Início',
  message: 'Mensagem',
  question: 'Pergunta',
  condition: 'Condição',
  action: 'Ação',
  delay: 'Atraso',
  ai_response: 'Resposta IA',
  end: 'Fim',
  list_message: 'Lista',
  validation: 'Validação',
  sub_flow: 'Sub-fluxo',
  round_robin: 'Round Robin',
};

interface ChatbotFlowAnalyticsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  nodes: Node[];
}

export const ChatbotFlowAnalytics = ({ open, onOpenChange, flowId, nodes }: ChatbotFlowAnalyticsProps) => {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading } = useChatbotFlowAnalytics(flowId, days);

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return nodeId;
    const data = node.data as Record<string, any>;
    return data?.label || data?.message?.substring(0, 30) || data?.question?.substring(0, 30) || nodeTypeLabels[node.type || ''] || nodeId;
  };

  const isInteractiveNode = (type: string) => type === 'question' || type === 'list_message';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Métricas do Funil
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{analytics?.total_executions || 0} execuções</span>
            </div>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !analytics?.nodes.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum dado de execução encontrado neste período.</p>
            <p className="text-sm mt-1">Execute o fluxo para começar a coletar métricas.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Alcançados</TableHead>
                <TableHead className="text-right">Responderam</TableHead>
                <TableHead className="text-right">Alcance %</TableHead>
                <TableHead>Funil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.nodes.map((node) => (
                <TableRow key={node.node_id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {getNodeLabel(node.node_id)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {nodeTypeLabels[node.node_type] || node.node_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{node.total_reached}</TableCell>
                  <TableCell className="text-right">
                    {isInteractiveNode(node.node_type) ? node.total_responded : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {node.reach_rate}%
                  </TableCell>
                  <TableCell className="w-[120px]">
                    <Progress value={node.reach_rate} className="h-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {analytics && analytics.nodes.some(n => isInteractiveNode(n.node_type)) && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <strong>Dica:</strong> A coluna "Responderam" mostra quantos leads efetivamente responderam nos nós de pergunta e lista.
            A taxa de resposta ajuda a identificar onde os leads estão abandonando o fluxo.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
