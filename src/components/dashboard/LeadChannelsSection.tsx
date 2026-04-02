import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadChannelMetrics, DateRange, CustomDateRange } from '@/hooks/useDashboardMetricsV2';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface LeadChannelsSectionProps {
  dateRange: DateRange;
  customRange?: CustomDateRange;
}

const COLORS = [
  'hsl(142, 71%, 45%)',   // WhatsApp green
  'hsl(217, 91%, 60%)',   // Blue
  'hsl(280, 87%, 65%)',   // Purple
  'hsl(48, 96%, 53%)',    // Yellow
  'hsl(var(--primary))',  // Primary
  'hsl(350, 89%, 60%)',   // Red
];

export const LeadChannelsSection = ({ dateRange, customRange }: LeadChannelsSectionProps) => {
  const { data, isLoading } = useLeadChannelMetrics(dateRange, customRange);
  const [expandedForm, setExpandedForm] = useState(false);

  const pieData = data?.channels.map((item, index) => ({
    name: item.channel,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const formChannel = data?.channels.find(c => c.channel === 'Formulário');

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          📊 Leads por Canal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="flex flex-col items-center p-4 rounded-lg border bg-card">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="text-2xl font-bold">{(data?.totalLeads || 0).toLocaleString()}</span>
          )}
          <span className="text-sm text-muted-foreground">Total de leads no período</span>
        </div>

        {/* Channel breakdown */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))
          ) : (
            data?.channels.map((channel, index) => (
              <div key={channel.channel}>
                <div 
                  className="flex items-center justify-between p-2 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => channel.channel === 'Formulário' && setExpandedForm(!expandedForm)}
                >
                  <div className="flex items-center gap-2">
                    <span>{channel.icon}</span>
                    <span className="text-sm font-medium">{channel.channel}</span>
                    {channel.channel === 'Formulário' && channel.details && channel.details.length > 0 && (
                      expandedForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{channel.count.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">
                      ({data?.totalLeads ? ((channel.count / data.totalLeads) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
                {/* Form details */}
                {channel.channel === 'Formulário' && expandedForm && channel.details && (
                  <div className="ml-6 mt-1 space-y-1">
                    {channel.details.map(detail => (
                      <div key={detail.name} className="flex items-center justify-between p-1.5 rounded border bg-muted/50 text-xs">
                        <span className="truncate max-w-[200px]">📋 {detail.name}</span>
                        <span className="font-medium">{detail.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), 'Leads']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '10px' }}
                  formatter={(value) => <span className="text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
