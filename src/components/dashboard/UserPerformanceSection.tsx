import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserPerformanceDetailed, DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import { Users, Clock, MessageSquare, Type } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserPerformanceSectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

const formatWorkTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatResponseTime = (seconds: number): string => {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return `R$ ${value.toFixed(0)}`;
};

const formatChars = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

export const UserPerformanceSection = ({ dateRange, customRange }: UserPerformanceSectionProps) => {
  const { data, isLoading } = useUserPerformanceDetailed(dateRange, customRange);

  const totalMessages = data?.users.reduce((s, u) => s + u.messagesSent, 0) || 0;
  const totalConversations = data?.users.reduce((s, u) => s + u.conversationsHandled, 0) || 0;
  const totalRevenue = data?.users.reduce((s, u) => s + u.totalRevenue, 0) || 0;

  const summaryCards = [
    { title: 'Usuários Ativos', value: data?.users.length || 0, icon: Users },
    { title: 'Msgs Enviadas', value: totalMessages, icon: MessageSquare },
    { title: 'Caracteres Totais', value: formatChars(data?.totalCharactersTyped || 0), icon: Type, isText: true },
    { title: 'Receita Gerada', value: formatCurrency(totalRevenue), icon: Clock, isText: true },
  ];

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">🥇</Badge>;
    if (index === 1) return <Badge className="bg-gray-400/20 text-gray-500 border-gray-400/30">🥈</Badge>;
    if (index === 2) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">🥉</Badge>;
    return <Badge variant="outline">{index + 1}º</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          👥 Performance dos Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {summaryCards.map((card, index) => (
            <div key={index} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              <card.icon className="h-4 w-4 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                {isLoading ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="font-semibold text-sm truncate">
                    {card.isText ? card.value : card.value.toLocaleString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate">{card.title}</span>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data?.users && data.users.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center whitespace-nowrap" title="Tempo ativo estimado: intervalo entre a 1ª e última mensagem de cada dia">Tempo/Dia ⓘ</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Caracteres</TableHead>
                  <TableHead className="text-center">Msgs</TableHead>
                  <TableHead className="text-center">Atend.</TableHead>
                  <TableHead className="text-center">Abertos</TableHead>
                  <TableHead className="text-center">Ganhos</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Win Rate</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Ticket Médio</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Resp. Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user, index) => (
                  <TableRow key={user.userId}>
                    <TableCell className="py-2">{getRankBadge(index)}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-xs">
                            {user.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[110px]">
                          {user.userName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2 text-sm">
                      {user.avgDailyWorkSeconds > 0 ? (
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {formatWorkTime(user.avgDailyWorkSeconds)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2 text-sm">
                      {user.charactersTyped > 0 ? (
                        <span className="font-medium">{formatChars(user.charactersTyped)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2 text-sm">{user.messagesSent || '—'}</TableCell>
                    <TableCell className="text-center py-2 text-sm">{user.conversationsHandled || '—'}</TableCell>
                    <TableCell className="text-center py-2 text-sm">{user.dealsOpen}</TableCell>
                    <TableCell className="text-center py-2 text-sm">
                      {user.dealsWon > 0 ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">{user.dealsWon}</span>
                      ) : '0'}
                    </TableCell>
                    <TableCell className="text-center py-2 text-sm">
                      {user.dealsWon + user.dealsLost > 0 ? (
                        <span className={user.winRate >= 50 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-amber-600 dark:text-amber-400'}>
                          {user.winRate.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2 text-sm">
                      {user.avgTicket > 0 ? formatCurrency(user.avgTicket) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right py-2 text-sm font-medium">
                      {user.totalRevenue > 0 ? (
                        <span className="text-green-600 dark:text-green-400">{formatCurrency(user.totalRevenue)}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right py-2 text-sm text-muted-foreground">
                      {formatResponseTime(user.avgResponseTimeSeconds)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum dado de usuário disponível no período
          </div>
        )}
      </CardContent>
    </Card>
  );
};
