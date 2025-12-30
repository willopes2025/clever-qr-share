import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOverviewMetrics, DateRange } from '@/hooks/useDashboardMetricsV2';
import { Users, MessageSquare, Bot, User, AlertCircle, Clock, TrendingUp } from 'lucide-react';

interface OverviewSectionProps {
  dateRange: DateRange;
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

export const OverviewSection = ({ dateRange }: OverviewSectionProps) => {
  const { data, isLoading } = useOverviewMetrics(dateRange);

  const metrics = [
    {
      title: 'Leads Recebidos',
      value: data?.leadsToday || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Conversas Ativas',
      value: data?.activeConversations || 0,
      icon: MessageSquare,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Atend. Automáticos',
      value: data?.autoAttendances || 0,
      icon: Bot,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Atend. Humanos',
      value: data?.humanAttendances || 0,
      icon: User,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Sem Resposta',
      value: data?.unansweredLeads || 0,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Tempo 1ª Resposta',
      value: formatTime(data?.avgFirstResponseTime || 0),
      icon: Clock,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      isText: true,
    },
    {
      title: 'Taxa de Resposta',
      value: `${(data?.responseRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      isText: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          📊 Visão Geral
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className={`p-2 rounded-full ${metric.bgColor} mb-2`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className="text-xl font-bold">
                  {metric.isText ? metric.value : metric.value.toLocaleString()}
                </span>
              )}
              <span className="text-xs text-muted-foreground text-center mt-1">
                {metric.title}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
