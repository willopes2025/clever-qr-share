import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgentPerformanceMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { Users, Clock, MessageSquare, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface AgentPerformanceSectionProps {
  dateRange: DateRange;
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

const formatCurrency = (value: number): string => {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

export const AgentPerformanceSection = ({ dateRange }: AgentPerformanceSectionProps) => {
  const { data, isLoading } = useAgentPerformanceMetrics(dateRange);

  const summaryCards = [
    { title: 'Total Atendimentos', value: data?.totalAttendances || 0, icon: Users },
    { title: 'Tempo Médio Resp.', value: formatTime(data?.avgResponseTime || 0), icon: Clock, isText: true },
    { title: 'Abandonadas', value: data?.abandonedConversations || 0, icon: MessageSquare },
    { title: 'Retomadas', value: data?.resumedConversations || 0, icon: Trophy },
  ];

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">🥇</Badge>;
    if (index === 1) return <Badge className="bg-gray-400/20 text-gray-500 border-gray-400/30">🥈</Badge>;
    if (index === 2) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">🥉</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          🧍 Atendimento Humano
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {summaryCards.map((card, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <card.icon className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                {isLoading ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="font-semibold text-sm">
                    {card.isText ? card.value : card.value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{card.title}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Agent Ranking Table */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Ranking de Atendentes</span>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : data?.agents && data.agents.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Atendente</TableHead>
                    <TableHead className="text-center">Atend.</TableHead>
                    <TableHead className="text-center">Msgs</TableHead>
                    <TableHead className="text-center">Deals</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agents.slice(0, 5).map((agent, index) => (
                    <TableRow key={agent.agentId}>
                      <TableCell>{getRankBadge(index)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {agent.agentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate max-w-[100px]">
                            {agent.agentName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{agent.attendances}</TableCell>
                      <TableCell className="text-center">{agent.messagesSent}</TableCell>
                      <TableCell className="text-center">{agent.dealsWon}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(agent.dealsValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum dado de atendente disponível
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
