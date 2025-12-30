import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTeamProductivityMetrics, DateRange } from '@/hooks/useAdvancedDashboardMetrics';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamPerformanceTableProps {
  dateRange: DateRange;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
        <Trophy className="h-4 w-4 text-yellow-500" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400/20">
        <Medal className="h-4 w-4 text-gray-400" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20">
        <Award className="h-4 w-4 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
      <span className="text-sm font-medium text-muted-foreground">{rank}</span>
    </div>
  );
}

export function TeamPerformanceTable({ dateRange }: TeamPerformanceTableProps) {
  const { data, isLoading } = useTeamProductivityMetrics(dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ranking de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const members = data?.memberData || [];

  if (members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ranking de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nenhum dado de performance no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ranking de Performance</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-6">#</TableHead>
              <TableHead>Membro</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead className="text-right">Deals</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right pr-6">Tarefas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.userId} className="hover:bg-muted/50">
                <TableCell className="pl-6">
                  <RankBadge rank={index + 1} />
                </TableCell>
                <TableCell>
                  <span className="font-medium">{member.userName}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="font-mono">
                    {formatTime(member.workSeconds)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-muted-foreground">{member.messagesSent}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    'font-medium',
                    member.dealsWon > 0 ? 'text-green-600' : 'text-muted-foreground'
                  )}>
                    {member.dealsWon}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium">{formatCurrency(member.dealsValue)}</span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <span className="text-muted-foreground">{member.tasksCompleted}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
