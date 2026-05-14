import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users,
  MessageSquare,
  MessageCircle,
  Clock,
  Type,
  TrendingUp,
  DollarSign,
  Activity,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemberProductivity, MemberProductivity } from '@/hooks/useMemberProductivity';
import { DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';

interface MemberProductivitySectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

const formatTime = (s: number) => {
  if (!s) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatNumber = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(v);

const statusConfig: Record<MemberProductivity['currentStatus'], { label: string; cls: string }> = {
  work: { label: 'Trabalhando', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  break: { label: 'Pausa', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  lunch: { label: 'Almoço', cls: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  meeting: { label: 'Reunião', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  offline: { label: 'Offline', cls: 'bg-muted text-muted-foreground border-border' },
};

const KpiTile = ({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  loading?: boolean;
}) => (
  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
    <div className="p-2 rounded-md bg-primary/10">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="flex flex-col min-w-0">
      {loading ? (
        <Skeleton className="h-5 w-16" />
      ) : (
        <span className="font-semibold text-sm truncate">{value}</span>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  </div>
);

export const MemberProductivitySection = ({
  dateRange,
  customRange,
}: MemberProductivitySectionProps) => {
  const { data, isLoading } = useMemberProductivity(dateRange, customRange);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = data?.members || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [data?.members, search]);

  const totals = data?.totals;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Produtividade por Membro
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs do time */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <KpiTile
            icon={Clock}
            label="Horas trabalhadas"
            value={formatTime(totals?.workSeconds || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={MessageSquare}
            label="Mensagens enviadas"
            value={formatNumber(totals?.messagesSent || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={MessageCircle}
            label="Mensagens recebidas"
            value={formatNumber(totals?.messagesReceived || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={Type}
            label="Caracteres digitados"
            value={formatNumber(totals?.charactersTyped || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={Activity}
            label="Conversas atendidas"
            value={formatNumber(totals?.conversationsHandled || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={TrendingUp}
            label="Deals ganhos"
            value={formatNumber(totals?.dealsWon || 0)}
            loading={isLoading}
          />
          <KpiTile
            icon={DollarSign}
            label="Valor fechado"
            value={formatCurrency(totals?.dealsValue || 0)}
            loading={isLoading}
          />
        </div>

        {/* Tabela */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Membro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Pausas</TableHead>
                <TableHead className="text-right">Msgs ↑</TableHead>
                <TableHead className="text-right">Msgs ↓</TableHead>
                <TableHead className="text-right">Caract.</TableHead>
                <TableHead className="text-right">Áudios</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">Resp. méd.</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Tarefas</TableHead>
                <TableHead className="text-right">Notas</TableHead>
                <TableHead className="text-right">Última ativ.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={15}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    Nenhum membro com atividade no período.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const status = statusConfig[m.currentStatus];
                  return (
                    <TableRow key={m.userId} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                            <AvatarFallback className="text-xs">
                              {m.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate max-w-[140px]">
                              {m.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {m.role === 'owner' ? 'Dono' : m.role === 'admin' ? 'Admin' : 'Membro'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', status.cls)}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatTime(m.workSeconds)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatTime(m.breakSeconds + m.lunchSeconds)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(m.messagesSent)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatNumber(m.messagesReceived)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatNumber(m.charactersTyped)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatNumber(m.charactersTyped)} caracteres digitados
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(m.audiosSent)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(m.conversationsHandled)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m.avgResponseSeconds ? formatTime(m.avgResponseSeconds) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span
                          className={cn(
                            m.dealsWon > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground',
                          )}
                        >
                          {m.dealsWon}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(m.dealsValue)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {m.tasksCompleted}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {m.notesCreated}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m.lastActivityAt
                          ? formatDistanceToNow(new Date(m.lastActivityAt), {
                              locale: ptBR,
                              addSuffix: true,
                            })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Métricas agregadas do período selecionado. Status atual atualizado em tempo real a partir
          das sessões de trabalho de cada membro.
        </p>
      </CardContent>
    </Card>
  );
};
